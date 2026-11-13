// app/minesweeper/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";
import { Bomb, Flag, Hand, MousePointerClick, RotateCcw, Timer, Trophy, X } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice } from "@/components/ui/ToolUI";

/* ================================================================
   棋盘模型（全部为模块级纯函数，随机只发生在事件回调里）
   ================================================================ */

type CellState = "hidden" | "open" | "flag";
type Status = "ready" | "playing" | "won" | "lost";

interface Cell {
  mine: boolean;
  /** 周围 8 格的雷数 */
  count: number;
  state: CellState;
}

type LevelKey = "easy" | "medium" | "hard";

interface Level {
  label: string;
  rows: number;
  cols: number;
  mines: number;
  /** 每格边长（px） */
  cell: number;
}

const LEVELS: Record<LevelKey, Level> = {
  easy: { label: "初级", rows: 9, cols: 9, mines: 10, cell: 40 },
  medium: { label: "中级", rows: 16, cols: 16, mines: 40, cell: 40 },
  hard: { label: "高级", rows: 16, cols: 30, mines: 99, cell: 34 },
};

const LEVEL_ORDER: LevelKey[] = ["easy", "medium", "hard"];

/** 与 globals.css 里 .mine-grid 的 gap 保持一致，用于算棋盘最大宽度 */
const GAP = 2;

const BEST_KEY = "tools.minesweeper.best";

const NUMBER_COLOR: Record<number, string> = {
  1: "text-blue-600",
  2: "text-emerald-600",
  3: "text-red-600",
  4: "text-indigo-700",
  5: "text-amber-700",
  6: "text-cyan-600",
  7: "text-slate-800",
  8: "text-slate-500",
};

function makeBoard(rows: number, cols: number): Cell[] {
  return Array.from({ length: rows * cols }, (): Cell => ({
    mine: false,
    count: 0,
    state: "hidden",
  }));
}

/** 某格周围 8 个合法邻格索引 */
function neighbors(index: number, rows: number, cols: number): number[] {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols) out.push(r * cols + c);
    }
  }
  return out;
}

/** 首次点击后才布雷：点开的那格及其邻格保证无雷（首点必安全） */
function scatterMines(
  base: Cell[],
  rows: number,
  cols: number,
  mineCount: number,
  safe: number
): Cell[] {
  const total = rows * cols;
  const banned = new Set<number>([safe, ...neighbors(safe, rows, cols)]);
  let pool: number[] = [];
  for (let i = 0; i < total; i++) if (!banned.has(i)) pool.push(i);
  // 雷太多、安全区挤满可选格时，退化为只保护点击的那一格
  if (pool.length < mineCount) {
    pool = [];
    for (let i = 0; i < total; i++) if (i !== safe) pool.push(i);
  }
  // 只需抽出 mineCount 个，做部分洗牌即可，不必打乱整池
  for (let i = 0; i < mineCount; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const next = base.map((cell) => ({ ...cell }));
  for (const index of pool.slice(0, mineCount)) next[index].mine = true;
  for (let i = 0; i < total; i++) {
    if (next[i].mine) continue;
    next[i].count = neighbors(i, rows, cols).filter((n) => next[n].mine).length;
  }
  return next;
}

/** 翻开一格；是 0 时用栈向四周扩散 */
function reveal(
  base: Cell[],
  rows: number,
  cols: number,
  index: number
): { board: Cell[]; hitMine: boolean } {
  const target = base[index];
  if (!target || target.state === "open") return { board: base, hitMine: false };

  const next = base.map((cell) => ({ ...cell }));
  if (next[index].mine) {
    next[index].state = "open";
    return { board: next, hitMine: true };
  }

  const stack = [index];
  while (stack.length) {
    const i = stack.pop();
    if (i === undefined) break;
    const cell = next[i];
    if (cell.state !== "hidden") continue;
    cell.state = "open";
    if (cell.count === 0) {
      for (const n of neighbors(i, rows, cols)) {
        if (next[n].state === "hidden") stack.push(n);
      }
    }
  }
  return { board: next, hitMine: false };
}

function toggleFlag(base: Cell[], index: number): Cell[] {
  const cell = base[index];
  if (!cell || cell.state === "open") return base;
  const next = base.map((c) => ({ ...c }));
  next[index].state = cell.state === "flag" ? "hidden" : "flag";
  return next;
}

/**
 * 快速展开：点已翻开的数字格，若周围旗数正好等于数字，
 * 则把其余未翻开且未插旗的邻格一起翻开（经典「双击展开」）。
 */
function chord(
  base: Cell[],
  rows: number,
  cols: number,
  index: number
): { board: Cell[]; hitMine: boolean } | null {
  const cell = base[index];
  if (!cell || cell.state !== "open" || cell.count === 0) return null;

  const around = neighbors(index, rows, cols);
  const flags = around.filter((n) => base[n].state === "flag").length;
  if (flags !== cell.count) return null;

  const targets = around.filter((n) => base[n].state === "hidden");
  if (!targets.length) return null;

  let working = base;
  let hitMine = false;
  for (const target of targets) {
    const result = reveal(working, rows, cols, target);
    working = result.board;
    if (result.hitMine) hitMine = true;
  }
  return { board: working, hitMine };
}

function isWin(board: Cell[]): boolean {
  return board.every((cell) => cell.mine || cell.state === "open");
}

/* ================================================================
   展示型子组件（模块级定义，避免每次渲染重建）
   ================================================================ */

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType<{ size?: number; className?: string }>;
  label: string;
  value: ReactNode;
}) {
  return (
    <div
      title={label}
      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
    >
      <Icon size={14} className="text-slate-500" />
      {/* 窄屏只留图标 + 数字，省出空间让「重新开始」和它们排在同一行 */}
      <span className="hidden sm:inline text-slate-500 text-xs">{label}</span>
      <span className="font-mono font-semibold text-slate-800 tabular-nums">{value}</span>
    </div>
  );
}

function CellButton({
  cell,
  index,
  cols,
  lost,
  frozen,
  onOpen,
  onFlag,
}: {
  cell: Cell;
  index: number;
  cols: number;
  lost: boolean;
  frozen: boolean;
  onOpen: () => void;
  onFlag: (event: React.MouseEvent) => void;
}) {
  const open = cell.state === "open";
  const showMine = lost && cell.mine && cell.state !== "flag";
  const wrongFlag = lost && !cell.mine && cell.state === "flag";

  // 未翻开用较深的灰、翻开用极浅的灰，对比一眼能分清
  let tone = "bg-slate-300 hover:bg-slate-400/70 ";
  if (showMine) tone = "bg-red-200 ";
  else if (wrongFlag) tone = "bg-red-100 ";
  else if (open) tone = "bg-slate-50 ";

  const color = open && !cell.mine && NUMBER_COLOR[cell.count] ? NUMBER_COLOR[cell.count] : "";

  let content: ReactNode = null;
  if (showMine) {
    content = <Bomb className="w-[56%] h-[56%]" strokeWidth={2} />;
  } else if (wrongFlag) {
    content = <X className="w-[56%] h-[56%] text-red-500" strokeWidth={2.5} />;
  } else if (cell.state === "flag") {
    content = <Flag className="w-[48%] h-[48%] text-indigo-600" fill="currentColor" />;
  } else if (open && cell.count > 0) {
    content = cell.count;
  }

  const row = Math.floor(index / cols) + 1;
  const col = (index % cols) + 1;
  const description = showMine
    ? "地雷"
    : wrongFlag
      ? "错误的旗标"
      : cell.state === "flag"
        ? "已插旗"
        : open
          ? cell.count > 0
            ? `周围 ${cell.count} 个雷`
            : "空白"
          : "未翻开";

  return (
    <button
      type="button"
      onClick={onOpen}
      onContextMenu={onFlag}
      disabled={frozen}
      className={`mine-cell flex items-center justify-center rounded-[3px] font-bold select-none transition-colors ${tone}${color} disabled:cursor-default`}
      aria-label={`第 ${row} 行第 ${col} 列，${description}`}
    >
      {content}
    </button>
  );
}

/* ================================================================ */

export default function MinesweeperPage() {
  const [level, setLevel] = useState<LevelKey>("easy");
  const [board, setBoard] = useState<Cell[]>(() =>
    makeBoard(LEVELS.easy.rows, LEVELS.easy.cols)
  );
  const [status, setStatus] = useState<Status>("ready");
  const [time, setTime] = useState(0);
  const [flagMode, setFlagMode] = useState(false);
  const [best, setBest] = useState<Partial<Record<LevelKey, number>>>({});

  const cfg = LEVELS[level];
  const { rows, cols, mines } = cfg;

  const flags = board.reduce((sum, cell) => sum + (cell.state === "flag" ? 1 : 0), 0);
  const remaining = mines - flags;
  const frozen = status === "won" || status === "lost";
  const bestTime = best[level];

  // 最佳成绩只存本机：挂载后异步补上，避免服务端渲染与客户端首帧不一致
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(BEST_KEY);
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setBest(parsed as Partial<Record<LevelKey, number>>);
        }
      } catch {
        // 隐私模式禁用存储或数据损坏时忽略，不影响游戏
      }
    });
  }, []);

  // 只有真正开始后才计时；暂停在 ready / 结束时自然停止
  useEffect(() => {
    if (status !== "playing") return;
    const id = window.setInterval(() => setTime((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  const reset = useCallback((next: LevelKey) => {
    setLevel(next);
    setBoard(makeBoard(LEVELS[next].rows, LEVELS[next].cols));
    setStatus("ready");
    setTime(0);
  }, []);

  const recordBest = useCallback(
    (seconds: number) => {
      setBest((prev) => {
        const current = prev[level];
        if (current !== undefined && current <= seconds) return prev;
        const next = { ...prev, [level]: seconds };
        try {
          window.localStorage.setItem(BEST_KEY, JSON.stringify(next));
        } catch {
          // 写不进去也不影响本局结果
        }
        return next;
      });
    },
    [level]
  );

  const applyResult = useCallback(
    (nextBoard: Cell[], hitMine: boolean) => {
      if (hitMine) {
        setBoard(nextBoard);
        setStatus("lost");
        return;
      }
      if (isWin(nextBoard)) {
        // 胜利时把剩下的雷自动插旗，棋盘看起来更完整
        setBoard(nextBoard.map((cell): Cell => (cell.mine ? { ...cell, state: "flag" } : cell)));
        setStatus("won");
        recordBest(time);
        return;
      }
      setBoard(nextBoard);
    },
    [recordBest, time]
  );

  const handleOpen = (index: number) => {
    if (frozen) return;
    const cell = board[index];
    if (!cell) return;

    // 标记模式：触屏上没有右键，点一下就是插旗
    if (flagMode) {
      setBoard(toggleFlag(board, index));
      return;
    }

    // 已插旗的格子不响应左键，避免误触翻开
    if (cell.state === "flag") return;

    // 点已翻开的数字格：周围旗数匹配时快速展开
    if (cell.state === "open") {
      const result = chord(board, rows, cols, index);
      if (result) applyResult(result.board, result.hitMine);
      return;
    }

    // 第一次点击时才布雷，并把这一格及其邻格设为安全区
    if (status === "ready") {
      const seeded = scatterMines(board, rows, cols, mines, index);
      const result = reveal(seeded, rows, cols, index);
      setStatus("playing");
      setTime(0);
      applyResult(result.board, result.hitMine);
      return;
    }

    const result = reveal(board, rows, cols, index);
    applyResult(result.board, result.hitMine);
  };

  const handleFlag = (event: React.MouseEvent, index: number) => {
    event.preventDefault();
    if (frozen) return;
    setBoard(toggleFlag(board, index));
  };

  return (
    <ToolShell>
      <div className="space-y-5">
        {/* 难度 / 数据 / 重开 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl" role="group" aria-label="难度">
            {LEVEL_ORDER.map((key) => {
              const active = key === level;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => reset(key)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                    active
                      ? "bg-white text-indigo-600 font-semibold shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  {LEVELS[key].label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <StatChip icon={Flag} label="剩余" value={remaining} />
            <StatChip icon={Timer} label="用时" value={`${time}s`} />
            <StatChip icon={Trophy} label="最佳" value={bestTime === undefined ? "—" : `${bestTime}s`} />
            <Button
              variant="secondary"
              size="sm"
              icon={RotateCcw}
              onClick={() => reset(level)}
              className="whitespace-nowrap"
            >
              <span className="hidden sm:inline">重新开始</span>
              <span className="sm:hidden">重开</span>
            </Button>
          </div>
        </div>

        {(status === "won" || status === "lost") && (
          <Notice tone={status === "won" ? "success" : "error"}>
            {status === "won"
              ? `全部安全格都已翻开，用时 ${time} 秒。换个难度继续挑战？`
              : "踩到地雷了。点「重新开始」再来一局，或换难度重开。"}
          </Notice>
        )}

        {/* 棋盘：高级 30 列在窄屏上横向滚动，不压缩格子 */}
        <div className="overflow-x-auto pb-1">
          <div
            className="mine-grid mx-auto"
            style={
              {
                maxWidth: cols * cfg.cell + (cols - 1) * GAP,
                "--cols": cols,
              } as CSSProperties
            }
          >
            {board.map((cell, index) => (
              <CellButton
                key={index}
                cell={cell}
                index={index}
                cols={cols}
                lost={status === "lost"}
                frozen={frozen}
                onOpen={() => handleOpen(index)}
                onFlag={(event) => handleFlag(event, index)}
              />
            ))}
          </div>
        </div>

        {/* 触屏辅助 + 操作说明 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => setFlagMode((v) => !v)}
            aria-pressed={flagMode}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors ${
              flagMode
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {flagMode ? <Hand size={16} /> : <MousePointerClick size={16} />}
            {flagMode ? "标记模式：点击即插旗" : "切换标记模式（触屏用）"}
          </button>

          <p className="text-xs text-slate-500 leading-relaxed">
            左键翻开 · 右键插旗 · 点已翻开的数字可快速展开周围
          </p>
        </div>
      </div>
    </ToolShell>
  );
}
