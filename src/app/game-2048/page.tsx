// app/game-2048/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Undo2 } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice } from "@/components/ui/ToolUI";

/* ================================================================
   棋盘模型：一维数组，0 表示空格。
   随机只发生在事件回调 / 挂载后的初始化里，渲染过程完全确定。
   ================================================================ */

const SIZE = 4;
const CELLS = SIZE * SIZE;
const BEST_KEY = "tools.game2048.best";

type Direction = "up" | "down" | "left" | "right";

interface Snapshot {
  board: number[];
  score: number;
  achieved: boolean;
}

const TILE_TONE: Record<number, string> = {
  2: "bg-white text-slate-700",
  // 4 用极浅暖色，和纯白的 2 拉开层次，同时接上 8 之后的橙色系
  4: "bg-amber-100 text-amber-900",
  8: "bg-orange-200 text-orange-900",
  16: "bg-orange-300 text-orange-950",
  32: "bg-orange-400 text-white",
  64: "bg-orange-500 text-white",
  128: "bg-amber-400 text-white",
  256: "bg-amber-500 text-white",
  512: "bg-amber-600 text-white",
  1024: "bg-indigo-500 text-white",
  2048: "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30",
};

const OVERFLOW_TONE = "bg-slate-800 text-white";

/** 按“从靠近滑动方向的那一侧开始”的顺序，给出 4 条线（行或列）的索引 */
function linesFor(direction: Direction): number[][] {
  const lines: number[][] = [];
  for (let i = 0; i < SIZE; i++) {
    const line: number[] = [];
    for (let j = 0; j < SIZE; j++) {
      if (direction === "left") line.push(i * SIZE + j);
      else if (direction === "right") line.push(i * SIZE + (SIZE - 1 - j));
      else if (direction === "up") line.push(j * SIZE + i);
      else line.push((SIZE - 1 - j) * SIZE + i);
    }
    lines.push(line);
  }
  return lines;
}

/** 执行一次滑动：压缩 → 合并 → 补零，并记录合并后的落点 */
function moveBoard(
  base: number[],
  direction: Direction
): { board: number[]; gained: number; moved: boolean; merged: number[] } {
  const next = [...base];
  const merged: number[] = [];
  let gained = 0;

  for (const line of linesFor(direction)) {
    const values = line.map((index) => base[index]).filter((value) => value !== 0);
    const result: number[] = [];

    for (let i = 0; i < values.length; i++) {
      if (i + 1 < values.length && values[i] === values[i + 1]) {
        const sum = values[i] * 2;
        result.push(sum);
        gained += sum;
        merged.push(line[result.length - 1]);
        i++; // 同一格一回合只合并一次
      } else {
        result.push(values[i]);
      }
    }
    while (result.length < SIZE) result.push(0);
    line.forEach((index, position) => {
      next[index] = result[position];
    });
  }

  const moved = next.some((value, index) => value !== base[index]);
  return { board: next, gained, moved, merged };
}

/** 在随机空位放一个 2（90%）或 4（10%） */
function spawn(base: number[]): { board: number[]; index: number } | null {
  const empty: number[] = [];
  base.forEach((value, index) => {
    if (value === 0) empty.push(index);
  });
  if (!empty.length) return null;

  const index = empty[Math.floor(Math.random() * empty.length)];
  const next = [...base];
  next[index] = Math.random() < 0.9 ? 2 : 4;
  return { board: next, index };
}

/** 还有空格，或存在可合并的相邻同值格 */
function canMove(board: number[]): boolean {
  for (let i = 0; i < CELLS; i++) {
    if (board[i] === 0) return true;
    const row = Math.floor(i / SIZE);
    const col = i % SIZE;
    if (col < SIZE - 1 && board[i] === board[i + 1]) return true;
    if (row < SIZE - 1 && board[i] === board[i + SIZE]) return true;
  }
  return false;
}

function createStart(): { board: number[]; indices: number[] } {
  let board = Array<number>(CELLS).fill(0);
  const indices: number[] = [];
  for (let i = 0; i < 2; i++) {
    const result = spawn(board);
    if (!result) break;
    board = result.board;
    indices.push(result.index);
  }
  return { board, indices };
}

function tileFont(value: number): string {
  if (value < 100) return "text-3xl sm:text-4xl";
  if (value < 1000) return "text-2xl sm:text-3xl";
  if (value < 10000) return "text-xl sm:text-2xl";
  return "text-lg sm:text-xl";
}

/* ================================================================
   展示型子组件
   ================================================================ */

function ScoreCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-center min-w-[78px]">
      <div className="text-[11px] text-slate-500 leading-tight">{label}</div>
      <div className="font-mono font-bold text-slate-800 tabular-nums leading-tight">{value}</div>
    </div>
  );
}

function Tile({ value }: { value: number }) {
  if (value === 0) {
    // 空格比棋盘底色略深，形成“凹槽”感
    return <div className="w-full h-full rounded-xl bg-slate-300/40" />;
  }
  const tone = TILE_TONE[value] ?? OVERFLOW_TONE;
  return (
    <div
      className={`tile-pop w-full h-full flex items-center justify-center rounded-xl font-bold select-none ${tone} ${tileFont(value)}`}
    >
      {value}
    </div>
  );
}

/* ================================================================ */

export default function Game2048Page() {
  const [board, setBoard] = useState<number[]>(() => Array<number>(CELLS).fill(0));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [status, setStatus] = useState<"playing" | "over">("playing");
  const [achieved, setAchieved] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([]);
  // 每个格子的“版本号”，变化一次就重挂载一次，用来只给新生成/新合并的方块播动画
  const [stamps, setStamps] = useState<number[]>(() => Array<number>(CELLS).fill(0));

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // 首帧渲染空盘（服务端与客户端一致），挂载后再随机开局
  useEffect(() => {
    queueMicrotask(() => {
      const start = createStart();
      setBoard(start.board);
      setStamps(() => {
        const next = Array<number>(CELLS).fill(0);
        for (const index of start.indices) next[index] = 1;
        return next;
      });
      try {
        const raw = window.localStorage.getItem(BEST_KEY);
        const parsed = raw === null ? 0 : Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) setBest(parsed);
      } catch {
        // 隐私模式禁用存储时忽略，本局仍可正常玩
      }
    });
  }, []);

  const applyMove = useCallback(
    (direction: Direction) => {
      if (status !== "playing" || !board.some((value) => value !== 0)) return;

      const result = moveBoard(board, direction);
      if (!result.moved) return;

      const spawned = spawn(result.board);
      const nextBoard = spawned ? spawned.board : result.board;
      const nextScore = score + result.gained;

      setHistory((prev) => [...prev.slice(-9), { board, score, achieved }]);
      setBoard(nextBoard);
      setScore(nextScore);
      setStamps((prev) => {
        const next = [...prev];
        for (const index of result.merged) next[index] += 1;
        if (spawned) next[spawned.index] += 1;
        return next;
      });

      if (nextScore > best) {
        setBest(nextScore);
        try {
          window.localStorage.setItem(BEST_KEY, String(nextScore));
        } catch {
          // 写不进去不影响本局
        }
      }
      if (!achieved && nextBoard.some((value) => value >= 2048)) setAchieved(true);
      if (!canMove(nextBoard)) setStatus("over");
    },
    [achieved, best, board, score, status]
  );

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last) return;
    setBoard(last.board);
    setScore(last.score);
    setAchieved(last.achieved);
    setStatus("playing");
    setHistory((prev) => prev.slice(0, -1));
    // 撤销不播动画，整盘静默回退
    setStamps(Array<number>(CELLS).fill(0));
  }, [history]);

  const newGame = useCallback(() => {
    const start = createStart();
    setBoard(start.board);
    setScore(0);
    setStatus("playing");
    setAchieved(false);
    setHistory([]);
    setStamps(() => {
      const next = Array<number>(CELLS).fill(0);
      for (const index of start.indices) next[index] = 1;
      return next;
    });
  }, []);

  // 方向键 / WASD；阻止方向键把页面滚走
  useEffect(() => {
    const keyMap: Record<string, Direction | undefined> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
      W: "up",
      S: "down",
      A: "left",
      D: "right",
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = keyMap[event.key];
      if (!direction) return;
      event.preventDefault();
      applyMove(direction);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyMove]);

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // 小于 24px 视为误触，不当作滑动
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;

    if (Math.abs(dx) > Math.abs(dy)) applyMove(dx > 0 ? "right" : "left");
    else applyMove(dy > 0 ? "down" : "up");
  };

  return (
    <ToolShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ScoreCard label="得分" value={score} />
            <ScoreCard label="最佳" value={best} />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Undo2}
              onClick={undo}
              disabled={history.length === 0}
            >
              撤销
            </Button>
            <Button variant="primary" size="sm" icon={RotateCcw} onClick={newGame}>
              新游戏
            </Button>
          </div>
        </div>

        {achieved && (
          <Notice tone="success">已合成 2048！可以继续挑战 4096 或更高。</Notice>
        )}
        {status === "over" && (
          <Notice tone="error">四个方向都动不了了，本局得分 {score}。点「新游戏」再来一局。</Notice>
        )}

        <div className="mx-auto w-full max-w-[480px]">
          <div
            className="grid grid-cols-4 grid-rows-4 gap-2 sm:gap-3 p-2 sm:p-3 bg-slate-200 rounded-2xl aspect-square touch-none select-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            role="grid"
            aria-label="2048 棋盘，用方向键或滑动移动方块"
          >
            {board.map((value, index) => (
              <div
                key={`${index}-${stamps[index]}`}
                role="gridcell"
                aria-label={value === 0 ? "空" : String(value)}
                className="min-w-0 min-h-0"
              >
                <Tile value={value} />
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-500 text-center leading-relaxed">
          方向键 / WASD 移动，手机上直接在棋盘上滑动；同值方块相撞会合并，每步随机生成一个新方块。
        </p>
      </div>
    </ToolShell>
  );
}
