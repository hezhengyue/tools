// app/gomoku/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ElementType, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Bot, CircleDot, RotateCcw, Undo2, Users, User } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice } from "@/components/ui/ToolUI";

/* ================================================================
   棋盘模型：全部是模块级纯函数，随机只出现在事件回调里。
   这一层不认识 React，将来的「房间码联机」只要把 place() 换成
   收到服务端棋谱后重建 state 即可，棋盘绘制与胜负判定不用改。
   ================================================================ */

const SIZE = 15;
const CELLS = SIZE * SIZE;

const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

type Side = 1 | 2;
type Mode = "ai" | "pvp";
type Level = "easy" | "normal" | "hard";

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** 棋型分值：连五最高，其次活四、冲四、活三…… */
const SCORE = {
  five: 1_000_000,
  openFour: 100_000,
  four: 10_000,
  openThree: 8_000,
  three: 800,
  openTwo: 400,
  two: 80,
  one: 10,
} as const;

const LEVELS: Record<Level, { label: string; desc: string }> = {
  easy: { label: "简单", desc: "会堵四，但常常顾此失彼" },
  normal: { label: "普通", desc: "攻守兼顾，能做出双三" },
  hard: { label: "困难", desc: "多看一步，会算你的反击" },
};
const LEVEL_ORDER: Level[] = ["easy", "normal", "hard"];

function createBoard(): Uint8Array {
  return new Uint8Array(CELLS);
}

function rowOf(index: number) {
  return Math.floor(index / SIZE);
}

function colOf(index: number) {
  return index % SIZE;
}

function cellAt(row: number, col: number) {
  return row * SIZE + col;
}

function inside(row: number, col: number) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

/** 以刚落下的这颗子为起点，检查四个方向是否连成五子；返回连线上的格子，未成五返回 null */
function findWin(board: Uint8Array, index: number, side: Side): number[] | null {
  const r0 = rowOf(index);
  const c0 = colOf(index);
  for (const [dr, dc] of DIRS) {
    const line = [index];
    for (const sign of [1, -1] as const) {
      let r = r0 + dr * sign;
      let c = c0 + dc * sign;
      while (inside(r, c) && board[cellAt(r, c)] === side) {
        line.push(cellAt(r, c));
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= 5) return line.sort((a, b) => a - b);
  }
  return null;
}

/** 现有棋子周围两格内的空点，作为候选落子；空盘时只给天元 */
function candidates(board: Uint8Array, radius = 2): number[] {
  const seen = new Uint8Array(CELLS);
  const out: number[] = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (board[cellAt(r, c)] === EMPTY) continue;
      for (let dr = -radius; dr <= radius; dr += 1) {
        for (let dc = -radius; dc <= radius; dc += 1) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inside(nr, nc)) continue;
          const index = cellAt(nr, nc);
          if (board[index] !== EMPTY || seen[index]) continue;
          seen[index] = 1;
          out.push(index);
        }
      }
    }
  }
  if (out.length === 0) {
    const center = cellAt(7, 7);
    if (board[center] === EMPTY) out.push(center);
  }
  return out;
}

/** 在 (r,c) 落子的前提下，某方向上的连子数与两端开放情况 */
function lineStats(
  board: Uint8Array,
  row: number,
  col: number,
  dr: number,
  dc: number,
  side: Side
) {
  let count = 1;
  let openA = false;
  let openB = false;

  let r = row + dr;
  let c = col + dc;
  while (inside(r, c) && board[cellAt(r, c)] === side) {
    count += 1;
    r += dr;
    c += dc;
  }
  if (inside(r, c) && board[cellAt(r, c)] === EMPTY) openA = true;

  r = row - dr;
  c = col - dc;
  while (inside(r, c) && board[cellAt(r, c)] === side) {
    count += 1;
    r -= dr;
    c -= dc;
  }
  if (inside(r, c) && board[cellAt(r, c)] === EMPTY) openB = true;

  return { count, open: (openA ? 1 : 0) + (openB ? 1 : 0) };
}

/** 在空点 (row,col) 落 side 子的价值：四个方向的棋型分加起来，同点造出多个强威胁再额外加权 */
function pointScore(board: Uint8Array, row: number, col: number, side: Side): number {
  let total = 0;
  let strongDirs = 0;

  for (const [dr, dc] of DIRS) {
    const { count, open } = lineStats(board, row, col, dr, dc, side);
    let value = 0;
    if (count >= 5) value = SCORE.five;
    else if (count === 4) value = open === 2 ? SCORE.openFour : open === 1 ? SCORE.four : 0;
    else if (count === 3) value = open === 2 ? SCORE.openThree : open === 1 ? SCORE.three : 0;
    else if (count === 2) value = open === 2 ? SCORE.openTwo : open === 1 ? SCORE.two : 0;
    else if (open === 2) value = SCORE.one;

    total += value;
    if (value >= SCORE.openThree) strongDirs += 1;
  }

  // 同一点同时形成两个强威胁（双活三 / 四三），实战中几乎无法同时防住
  if (strongDirs >= 2) total += SCORE.four;
  return total;
}

/** 在候选点里找「落下就直接连五」的位置，找不到返回 -1 */
function findImmediate(board: Uint8Array, list: number[], side: Side): number {
  for (const index of list) {
    board[index] = side;
    const win = findWin(board, index, side);
    board[index] = EMPTY;
    if (win) return index;
  }
  return -1;
}

/** 对手在当前局面下的最大威胁值，用于困难档的一步前瞻 */
function bestThreatValue(board: Uint8Array, side: Side, opponent: Side): number {
  let best = 0;
  for (const index of candidates(board)) {
    const atk = pointScore(board, rowOf(index), colOf(index), side);
    if (atk >= SCORE.five) return SCORE.five;
    const def = pointScore(board, rowOf(index), colOf(index), opponent);
    const value = atk + def * 0.8;
    if (value > best) best = value;
  }
  return best;
}

function chooseMove(board: Uint8Array, me: Side, level: Level): number {
  const opp = (3 - me) as Side;
  const list = candidates(board);
  if (list.length === 0) return -1;
  if (list.length === 1) return list[0];

  // 能赢先赢，其次必须堵
  const winNow = findImmediate(board, list, me);
  if (winNow >= 0) return winNow;
  const blockNow = findImmediate(board, list, opp);
  if (blockNow >= 0) return blockNow;

  const scored = list.map((index) => {
    const row = rowOf(index);
    const col = colOf(index);
    return {
      index,
      atk: pointScore(board, row, col, me),
      def: pointScore(board, row, col, opp),
    };
  });

  if (level === "easy") {
    scored.sort((a, b) => b.atk * 0.6 + b.def * 0.5 - (a.atk * 0.6 + a.def * 0.5));
    const pool = scored.slice(0, Math.min(5, scored.length));
    return pool[Math.floor(Math.random() * pool.length)].index;
  }

  if (level === "normal") {
    let best = scored[0];
    let bestValue = -Infinity;
    for (const item of scored) {
      const value = item.atk + item.def * 0.9;
      if (value > bestValue) {
        bestValue = value;
        best = item;
      }
    }
    return best.index;
  }

  // 困难：自己的收益 减去 对手反击的收益，取最优
  scored.sort((a, b) => b.atk + b.def - (a.atk + a.def));
  const top = scored.slice(0, 10);
  let bestMove = top[0].index;
  let bestValue = -Infinity;
  for (const item of top) {
    board[item.index] = me;
    const reply = bestThreatValue(board, opp, me);
    board[item.index] = EMPTY;
    const value = item.atk + item.def * 0.7 - reply * 0.85;
    if (value > bestValue) {
      bestValue = value;
      bestMove = item.index;
    }
  }
  return bestMove;
}

/* ================================================================
   对局状态
   ================================================================ */

interface GameState {
  board: Uint8Array;
  moves: number[];
  status: "playing" | "over";
  winner: 0 | Side;
  winLine: number[];
}

function newGame(): GameState {
  return { board: createBoard(), moves: [], status: "playing", winner: 0, winLine: [] };
}

/** 由棋谱重建棋盘：黑先白后，按手数奇偶着色 */
function rebuild(moves: number[]): GameState {
  const board = createBoard();
  moves.forEach((index, k) => {
    board[index] = k % 2 === 0 ? BLACK : WHITE;
  });
  return { board, moves, status: "playing", winner: 0, winLine: [] };
}

/** 落子：唯一的入口。接入联机后，服务端下发的棋谱也走这里。 */
function place(state: GameState, index: number): GameState {
  if (state.status !== "playing") return state;
  if (index < 0 || index >= CELLS) return state;
  if (state.board[index] !== EMPTY) return state;

  const side: Side = state.moves.length % 2 === 0 ? BLACK : WHITE;
  const board = Uint8Array.from(state.board);
  board[index] = side;
  const moves = [...state.moves, index];

  const winLine = findWin(board, index, side);
  if (winLine) return { board, moves, status: "over", winner: side, winLine };
  if (moves.length === CELLS) return { board, moves, status: "over", winner: 0, winLine: [] };
  return { board, moves, status: "playing", winner: 0, winLine: [] };
}

/** 悔棋步数：人机对战要退回到自己该走的回合 */
function undoSteps(moves: number, mode: Mode, humanSide: Side): number {
  if (moves === 0) return 0;
  if (mode === "pvp") return 1;
  const parity = humanSide === BLACK ? 0 : 1;
  const steps = moves % 2 === parity ? 2 : 1;
  if (moves - parity < 1) return 0;
  return Math.min(steps, moves);
}

/* ================================================================
   绘制
   ================================================================ */

/** 棋盘留白与格距：留 5.5% 边距，让边线上的子不被裁掉 */
function geometry(size: number) {
  const margin = size * 0.055;
  return { margin, step: (size - margin * 2) / (SIZE - 1) };
}

function drawStone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  side: Side
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  const gradient = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.35,
    radius * 0.12,
    x,
    y,
    radius
  );
  if (side === BLACK) {
    gradient.addColorStop(0, "#5d5d5d");
    gradient.addColorStop(1, "#0a0a0a");
    ctx.fillStyle = gradient;
    ctx.fill();
  } else {
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(1, "#d3ccc0");
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(120,108,88,0.45)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: ElementType }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="inline-flex p-1 bg-slate-100 rounded-xl" role="group" aria-label={label}>
      {options.map(({ value: item, label: text, icon: Icon }) => {
        const active = item === value;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-pressed={active}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-sm rounded-lg transition-all ${
              active
                ? "bg-white text-indigo-600 font-semibold shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            {Icon && <Icon size={14} strokeWidth={1.75} />}
            {text}
          </button>
        );
      })}
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
      <Icon size={14} className="text-slate-500" />
      <span className="hidden sm:inline text-slate-500 text-xs">{label}</span>
      <span className="font-semibold text-slate-800 tabular-nums">{value}</span>
    </div>
  );
}

/* ================================================================
   页面
   ================================================================ */

export default function GomokuPage() {
  const [mode, setMode] = useState<Mode>("ai");
  const [level, setLevel] = useState<Level>("normal");
  const [humanSide, setHumanSide] = useState<Side>(BLACK);
  const [state, setState] = useState<GameState>(newGame);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef(0);
  const hoverRef = useRef(-1);
  const viewRef = useRef({ state, mode, humanSide });

  const turn: Side = state.moves.length % 2 === 0 ? BLACK : WHITE;
  const aiSide: Side = humanSide === BLACK ? WHITE : BLACK;
  const thinking = mode === "ai" && state.status === "playing" && turn === aiSide;
  const humanTurn = state.status === "playing" && (mode === "pvp" || turn === humanSide);
  const steps = undoSteps(state.moves.length, mode, humanSide);
  const canUndo = state.status === "playing" && steps > 0;

  /* ---------------- 绘制 ---------------- */

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const size = sizeRef.current;
    if (!canvas || size <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = canvas.width / size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const { margin, step } = geometry(size);
    const radius = step * 0.44;
    const { state: current } = viewRef.current;

    // 木色底 + 网格
    ctx.fillStyle = "#f2e3c4";
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = "rgba(146,110,66,0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < SIZE; i += 1) {
      const p = margin + i * step;
      ctx.moveTo(margin, p);
      ctx.lineTo(size - margin, p);
      ctx.moveTo(p, margin);
      ctx.lineTo(p, size - margin);
    }
    ctx.stroke();

    // 星位
    ctx.fillStyle = "rgba(120,88,50,0.85)";
    for (const [r, c] of [
      [3, 3],
      [3, 11],
      [11, 3],
      [11, 11],
      [7, 7],
    ] as const) {
      ctx.beginPath();
      ctx.arc(margin + c * step, margin + r * step, Math.max(2, step * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }

    // 悬停预览：只在轮到自己落子时出现
    const hover = hoverRef.current;
    const { mode: currentMode, humanSide: currentHuman } = viewRef.current;
    const currentTurn: Side = current.moves.length % 2 === 0 ? BLACK : WHITE;
    const playable =
      current.status === "playing" && (currentMode === "pvp" || currentTurn === currentHuman);
    if (hover >= 0 && playable && current.board[hover] === EMPTY) {
      // 只是落点提示，压得很淡，避免被当成已经落下的子
      ctx.globalAlpha = 0.16;
      drawStone(
        ctx,
        margin + colOf(hover) * step,
        margin + rowOf(hover) * step,
        radius,
        currentTurn
      );
      ctx.globalAlpha = 1;
    }

    // 棋子
    for (let index = 0; index < CELLS; index += 1) {
      const side = current.board[index];
      if (side === EMPTY) continue;
      drawStone(
        ctx,
        margin + colOf(index) * step,
        margin + rowOf(index) * step,
        radius,
        side as Side
      );
    }

    // 最后一手标记
    const last = current.moves[current.moves.length - 1];
    if (last !== undefined && last >= 0) {
      const x = margin + colOf(last) * step;
      const y = margin + rowOf(last) * step;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
    }

    // 胜利连线
    if (current.winLine.length >= 5) {
      const first = current.winLine[0];
      const lastWin = current.winLine[current.winLine.length - 1];
      ctx.beginPath();
      ctx.moveTo(margin + colOf(first) * step, margin + rowOf(first) * step);
      ctx.lineTo(margin + colOf(lastWin) * step, margin + rowOf(lastWin) * step);
      ctx.strokeStyle = "rgba(220,38,38,0.85)";
      ctx.lineWidth = Math.max(2, step * 0.13);
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    viewRef.current = { state, mode, humanSide };
    render();
  }, [state, mode, humanSide, render]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const apply = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cssSize = wrap.clientWidth;
      if (cssSize <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(cssSize * dpr);
      canvas.height = Math.round(cssSize * dpr);
      canvas.style.height = `${cssSize}px`;
      sizeRef.current = cssSize;
      render();
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [render]);

  /* ---------------- AI 落子 ---------------- */

  useEffect(() => {
    if (mode !== "ai" || state.status !== "playing" || turn !== aiSide) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const board = Uint8Array.from(state.board);
      const move = chooseMove(board, aiSide, level);
      if (move >= 0) setState((prev) => place(prev, move));
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, state, turn, aiSide, level]);

  /* ---------------- 交互 ---------------- */

  const hitTest = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const size = sizeRef.current;
    if (!canvas || size <= 0) return -1;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / size || 1;
    const { margin, step } = geometry(size);
    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;
    const col = Math.round((x - margin) / step);
    const row = Math.round((y - margin) / step);
    if (!inside(row, col)) return -1;
    const dx = x - (margin + col * step);
    const dy = y - (margin + row * step);
    // 离交叉点太远视为误触
    if (Math.hypot(dx, dy) > step * 0.58) return -1;
    return cellAt(row, col);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (!humanTurn) return;
    const index = hitTest(event.clientX, event.clientY);
    if (index < 0) return;
    setState((prev) => place(prev, index));
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType !== "mouse") return;
    const index = hitTest(event.clientX, event.clientY);
    if (index === hoverRef.current) return;
    hoverRef.current = index;
    render();
  };

  const handlePointerLeave = () => {
    if (hoverRef.current === -1) return;
    hoverRef.current = -1;
    render();
  };

  const reset = useCallback(() => setState(newGame()), []);

  const undo = () => {
    const count = undoSteps(state.moves.length, mode, humanSide);
    if (count === 0) return;
    setState(rebuild(state.moves.slice(0, state.moves.length - count)));
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    setState(newGame());
  };

  const changeSide = (next: Side) => {
    setHumanSide(next);
    setState(newGame());
  };

  const sideName = (side: Side) => (side === BLACK ? "黑方" : "白方");
  const resultText =
    state.status !== "over"
      ? ""
      : state.winner === 0
        ? "棋盘满了，双方握手言和"
        : mode === "ai"
          ? state.winner === humanSide
            ? `你执${sideName(humanSide)}获胜`
            : `AI 执${sideName(state.winner)}获胜`
          : `${sideName(state.winner)}获胜`;

  return (
    <ToolShell>
      <div className="space-y-5">
        {/* 对局设置 */}
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="对战模式"
            value={mode}
            onChange={changeMode}
            options={[
              { value: "ai", label: "人机对战", icon: Bot },
              { value: "pvp", label: "同屏双人", icon: Users },
            ]}
          />
          {mode === "ai" && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">难度</span>
              <Segmented
                label="AI 难度"
                value={level}
                onChange={setLevel}
                options={LEVEL_ORDER.map((key) => ({ value: key, label: LEVELS[key].label }))}
              />
            </div>
          )}
          {mode === "ai" && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">执子</span>
              <Segmented
                label="我的棋子"
                value={String(humanSide) as "1" | "2"}
                onChange={(next) => changeSide(Number(next) as Side)}
                options={[
                  { value: "1", label: "执黑" },
                  { value: "2", label: "执白" },
                ]}
              />
            </div>
          )}
        </div>

        {/* 状态与操作 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatChip icon={CircleDot} label="手数" value={state.moves.length} />
            <StatChip
              icon={User}
              label="轮到"
              value={
                thinking ? "AI 思考中" : `${sideName(turn)}${mode === "ai" && turn === humanSide ? "（你）" : ""}`
              }
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Undo2}
              onClick={undo}
              disabled={!canUndo}
              className="whitespace-nowrap"
            >
              悔棋
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={RotateCcw}
              onClick={reset}
              className="whitespace-nowrap"
            >
              重开
            </Button>
          </div>
        </div>

        {state.status === "over" && (
          <Notice tone={state.winner === humanSide && mode === "ai" ? "success" : "info"}>
            <span aria-live="polite">
              {resultText}，共 {state.moves.length} 手。
              {mode === "ai" ? "点「重开」再来一局。" : "点「重开」交换先后手。"}
            </span>
          </Notice>
        )}

        {/* 棋盘 */}
        <div className="mx-auto w-full max-w-[520px]">
          <div ref={wrapRef} className="relative w-full aspect-square touch-none select-none">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              className={`block w-full rounded-2xl ring-1 ring-slate-200 ${
                humanTurn ? "cursor-crosshair" : "cursor-default"
              }`}
              role="img"
              aria-label={`五子棋棋盘，已下 ${state.moves.length} 手，轮到${sideName(turn)}`}
            />
          </div>
        </div>

        <p className="text-xs text-slate-500 text-center leading-relaxed">
          {mode === "ai"
            ? `你执${sideName(humanSide)}，${sideName(aiSide)}由 AI 走。难度：${LEVELS[level].desc}。`
            : "两人轮流在同一块棋盘上下，黑先白后。"}
          {" 点交叉点落子，最后一手有红点标记；横竖斜任意方向连成五子即胜。"}
        </p>
      </div>
    </ToolShell>
  );
}
