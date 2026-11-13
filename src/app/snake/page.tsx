// app/snake/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ElementType } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Zap,
} from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice } from "@/components/ui/ToolUI";

/* ================================================================
   棋盘模型（纯函数 + 事件回调里取随机，渲染过程完全确定）
   ================================================================ */

const COLS = 17;
const ROWS = 17;
const BEST_KEY = "tools.snake.best";
/** 每吃一个食物加多少分 */
const FOOD_SCORE = 10;

type Point = { x: number; y: number };
type Status = "ready" | "running" | "paused" | "over" | "won";

type SpeedKey = "slow" | "normal" | "fast";
const SPEEDS: Record<SpeedKey, { label: string; ms: number }> = {
  slow: { label: "悠闲", ms: 170 },
  normal: { label: "标准", ms: 120 },
  fast: { label: "极速", ms: 80 },
};
const SPEED_ORDER: SpeedKey[] = ["slow", "normal", "fast"];

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const;
type DirName = keyof typeof DIRS;

/** 开局：蛇横在棋盘正中，头朝右 */
function initialSnake(): Point[] {
  const y = Math.floor(ROWS / 2);
  const head = Math.floor(COLS / 2);
  return [
    { x: head, y },
    { x: head - 1, y },
    { x: head - 2, y },
  ];
}

/** 在空格里随机放食物；棋盘被填满时返回 null（通关） */
function spawnFood(snake: Point[]): Point | null {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  const free: Point[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (!free.length) return null;
  return free[Math.floor(Math.random() * free.length)];
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

/* ================================================================
   画布绘制
   ================================================================ */

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/* ================================================================ */

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType<{ size?: number; className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
      <Icon size={14} className="text-slate-500" />
      <span className="hidden sm:inline text-slate-500 text-xs">{label}</span>
      <span className="font-mono font-semibold text-slate-800 tabular-nums">{value}</span>
    </div>
  );
}

export default function SnakePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef(0);

  // 游戏数据全部放在 ref 里，rAF 循环直接读写，避免每帧触发 React 重渲染
  const snakeRef = useRef<Point[]>([]);
  const foodRef = useRef<Point | null>(null);
  const dirRef = useRef<Point>({ ...DIRS.right });
  const queueRef = useRef<Point[]>([]);
  const statusRef = useRef<Status>("ready");
  const scoreRef = useRef(0);
  const bestRef = useRef(0);
  const msRef = useRef(SPEEDS.normal.ms);

  const [status, setStatus] = useState<Status>("ready");
  const [score, setScore] = useState(0);
  const [length, setLength] = useState(3);
  const [best, setBest] = useState(0);
  const [speed, setSpeed] = useState<SpeedKey>("normal");

  const commitStatus = useCallback((next: Status) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  /** 回到开局（ready 还是直接开跑由调用方决定） */
  const reset = useCallback(
    (run: boolean) => {
      const snake = initialSnake();
      snakeRef.current = snake;
      dirRef.current = { ...DIRS.right };
      queueRef.current = [];
      foodRef.current = spawnFood(snake);
      scoreRef.current = 0;
      setScore(0);
      setLength(snake.length);
      commitStatus(run ? "running" : "ready");
    },
    [commitStatus]
  );

  const togglePause = useCallback(() => {
    if (statusRef.current === "running") commitStatus("paused");
    else if (statusRef.current === "paused") commitStatus("running");
    else if (statusRef.current === "ready") commitStatus("running");
    else reset(true);
  }, [commitStatus, reset]);

  /** 输入方向：禁止 180° 掉头，一个时间片最多缓存两个转向 */
  const turn = useCallback((dir: Point) => {
    if (statusRef.current === "over" || statusRef.current === "won") return;
    if (statusRef.current === "ready") {
      statusRef.current = "running";
      setStatus("running");
    }
    if (statusRef.current === "paused") return;
    const queue = queueRef.current;
    const base = queue.length ? queue[queue.length - 1] : dirRef.current;
    if (base.x === dir.x && base.y === dir.y) return;
    if (base.x === -dir.x && base.y === -dir.y) return;
    if (queue.length >= 2) return;
    queue.push(dir);
  }, []);

  // 挂载后补上最佳成绩，并铺好开局画面
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(BEST_KEY);
        const parsed = raw === null ? 0 : Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) {
          bestRef.current = parsed;
          setBest(parsed);
        }
      } catch {
        // 隐私模式禁用存储时忽略，本局仍可正常玩
      }
      if (!snakeRef.current.length) reset(false);
    });
  }, [reset]);

  // 速度切换后按新节奏重开
  useEffect(() => {
    msRef.current = SPEEDS[speed].ms;
  }, [speed]);

  /* ---------------- 主循环：rAF 负责节拍与重绘 ---------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const saveBest = (value: number) => {
      if (value <= bestRef.current) return;
      bestRef.current = value;
      setBest(value);
      try {
        window.localStorage.setItem(BEST_KEY, String(value));
      } catch {
        // 写不进去不影响本局
      }
    };

    const die = () => {
      statusRef.current = "over";
      setStatus("over");
      saveBest(scoreRef.current);
    };

    const win = () => {
      statusRef.current = "won";
      setStatus("won");
      saveBest(scoreRef.current);
    };

    const tick = () => {
      if (queueRef.current.length) {
        dirRef.current = queueRef.current.shift() ?? dirRef.current;
      }
      const snake = snakeRef.current;
      const head = snake[0];
      if (!head) return;
      const next = { x: head.x + dirRef.current.x, y: head.y + dirRef.current.y };

      // 撞墙
      if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
        die();
        return;
      }

      const food = foodRef.current;
      const eating = food !== null && samePoint(next, food);
      // 没吃到食物时尾巴会让位，所以尾格不算碰撞
      const body = eating ? snake : snake.slice(0, -1);
      if (body.some((p) => samePoint(p, next))) {
        die();
        return;
      }

      const updated = [next, ...body];
      snakeRef.current = updated;

      if (eating) {
        const gained = scoreRef.current + FOOD_SCORE;
        scoreRef.current = gained;
        setScore(gained);
        setLength(updated.length);
        const nextFood = spawnFood(updated);
        foodRef.current = nextFood;
        if (!nextFood) win();
      }
    };

    const draw = (now: number) => {
      const css = sizeRef.current;
      if (!css) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const cell = css / COLS;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, css, css);

      // 棋盘底色
      roundRectPath(ctx, 0, 0, css, css, 14);
      ctx.fillStyle = "#f1f5f9";
      ctx.fill();

      // 淡淡的网格点，方便判断距离
      ctx.fillStyle = "rgba(148, 163, 184, 0.35)";
      const dot = Math.max(1, cell * 0.06);
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          ctx.beginPath();
          ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, dot, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 食物：会轻微呼吸的红点
      const food = foodRef.current;
      if (food) {
        const pulse = 1 + Math.sin(now / 320) * 0.08;
        const r = cell * 0.32 * pulse;
        ctx.beginPath();
        ctx.arc((food.x + 0.5) * cell, (food.y + 0.5) * cell, r, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(
          (food.x + 0.4) * cell,
          (food.y + 0.38) * cell,
          Math.max(1, r * 0.3),
          0,
          Math.PI * 2
        );
        ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
        ctx.fill();
      }

      // 蛇：头深、身浅，逐节圆角方块
      const snake = snakeRef.current;
      const inset = Math.max(0.5, cell * 0.08);
      snake.forEach((segment, index) => {
        const isHead = index === 0;
        roundRectPath(
          ctx,
          segment.x * cell + inset,
          segment.y * cell + inset,
          cell - inset * 2,
          cell - inset * 2,
          cell * 0.3
        );
        if (isHead) ctx.fillStyle = "#4f46e5";
        else if (index % 2 === 0) ctx.fillStyle = "#6366f1";
        else ctx.fillStyle = "#818cf8";
        ctx.fill();
      });

      // 脑袋上点两只眼睛，指明前进方向
      const head = snake[0];
      if (head) {
        const dir = dirRef.current;
        const cx = (head.x + 0.5) * cell;
        const cy = (head.y + 0.5) * cell;
        const offset = cell * 0.17;
        const eyeR = Math.max(1, cell * 0.075);
        const perpendicular = { x: -dir.y, y: dir.x };
        for (const sign of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(
            cx + dir.x * offset + perpendicular.x * offset * sign,
            cy + dir.y * offset + perpendicular.y * offset * sign,
            eyeR,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = "#ffffff";
          ctx.fill();
        }
      }
    };

    // 画布尺寸跟随容器，按 DPR 放大保证清晰
    const applySize = () => {
      const css = wrap.clientWidth;
      if (!css) return;
      sizeRef.current = css;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(css * dpr);
      canvas.height = Math.round(css * dpr);
      canvas.style.height = `${css}px`;
    };

    const observer = new ResizeObserver(() => {
      applySize();
      draw(performance.now());
    });
    observer.observe(wrap);
    applySize();

    let raf = 0;
    let last = 0;
    let acc = 0;
    // 暂停 / 结束时不必每帧重绘，状态没变就复用上一帧
    let lastStatus: Status | null = null;

    const frame = (now: number) => {
      raf = window.requestAnimationFrame(frame);
      const current = statusRef.current;
      if (current !== "running") {
        last = now;
        if (lastStatus !== current) {
          lastStatus = current;
          draw(now);
        }
        return;
      }
      lastStatus = current;
      if (!last) last = now;
      acc += Math.min(now - last, 250); // 切回标签页时别一次性补上几十步
      last = now;
      if (acc >= msRef.current) {
        acc = 0;
        tick();
      }
      draw(now);
    };
    raf = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  /* ---------------- 键盘：方向键 / WASD，空格暂停 ---------------- */
  useEffect(() => {
    const keyMap: Record<string, DirName> = {
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
      if (event.key === " ") {
        event.preventDefault();
        togglePause();
        return;
      }
      const name = keyMap[event.key];
      if (!name) return;
      event.preventDefault();
      turn(DIRS[name]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePause, turn]);

  // 切到别的标签页时自动暂停，回来不会莫名其妙撞死
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && statusRef.current === "running") {
        statusRef.current = "paused";
        setStatus("paused");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /* ---------------- 触屏滑动 ---------------- */
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (touch) touchRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // 小于 24px 视为误触
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? DIRS.right : DIRS.left);
    else turn(dy > 0 ? DIRS.down : DIRS.up);
  };

  const overlay =
    status === "ready"
      ? { title: "准备好了吗", desc: "方向键 / WASD 或滑动屏幕开始", action: "开始" }
      : status === "paused"
        ? { title: "已暂停", desc: "按空格或点下面的按钮继续", action: "继续" }
        : null;

  return (
    <ToolShell>
      <div className="space-y-5">
        {/* 速度 / 数据 / 操作 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl" role="group" aria-label="速度">
            {SPEED_ORDER.map((key) => {
              const active = key === speed;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSpeed(key);
                    msRef.current = SPEEDS[key].ms;
                    reset(false);
                  }}
                  aria-pressed={active}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                    active
                      ? "bg-white text-indigo-600 font-semibold shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  {SPEEDS[key].label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <StatCard icon={Zap} label="得分" value={score} />
            <StatCard icon={Trophy} label="最高" value={best} />
            <Button
              variant="secondary"
              size="sm"
              icon={status === "running" ? Pause : Play}
              onClick={togglePause}
              className="whitespace-nowrap"
            >
              {status === "running" ? "暂停" : status === "paused" ? "继续" : "开始"}
            </Button>
            <Button variant="primary" size="sm" icon={RotateCcw} onClick={() => reset(true)} className="whitespace-nowrap">
              重开
            </Button>
          </div>
        </div>

        {(status === "over" || status === "won") && (
          <Notice tone={status === "won" ? "success" : "error"}>
            {status === "won"
              ? `棋盘被填满了，得分 ${score}，这局完美收官。`
              : `撞上去了，本局得分 ${score}、长度 ${length}。点「重开」再来一局。`}
          </Notice>
        )}

        {/* 棋盘 */}
        <div className="mx-auto w-full max-w-[460px]">
          <div
            ref={wrapRef}
            className="relative w-full aspect-square touch-none select-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <canvas
              ref={canvasRef}
              className="block w-full rounded-2xl"
              role="img"
              aria-label={`贪吃蛇棋盘，当前得分 ${score}，长度 ${length}`}
            />

            {overlay && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-900/35 backdrop-blur-[1px] text-center px-6">
                <p className="text-white font-semibold">{overlay.title}</p>
                <p className="text-white/75 text-xs">{overlay.desc}</p>
                <Button size="sm" icon={Play} onClick={togglePause} className="mt-1">
                  {overlay.action}
                </Button>
              </div>
            )}
          </div>

          {/* 方向键：手机可直接点，电脑也当作按钮用 */}
          <div className="mt-4 grid grid-cols-3 gap-1.5 w-[148px] mx-auto sm:hidden">
            <span />
            <button
              type="button"
              onClick={() => turn(DIRS.up)}
              aria-label="向上"
              className="flex items-center justify-center h-11 rounded-xl bg-white border border-slate-200 text-slate-600 active:bg-slate-100"
            >
              <ArrowUp size={18} />
            </button>
            <span />
            <button
              type="button"
              onClick={() => turn(DIRS.left)}
              aria-label="向左"
              className="flex items-center justify-center h-11 rounded-xl bg-white border border-slate-200 text-slate-600 active:bg-slate-100"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => turn(DIRS.down)}
              aria-label="向下"
              className="flex items-center justify-center h-11 rounded-xl bg-white border border-slate-200 text-slate-600 active:bg-slate-100"
            >
              <ArrowDown size={18} />
            </button>
            <button
              type="button"
              onClick={() => turn(DIRS.right)}
              aria-label="向右"
              className="flex items-center justify-center h-11 rounded-xl bg-white border border-slate-200 text-slate-600 active:bg-slate-100"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500 text-center leading-relaxed">
          方向键 / WASD 控制，手机上滑动棋盘或用下面的方向键；空格暂停，撞墙或咬到自己就结束，吃一个食物 {FOOD_SCORE} 分。
        </p>
      </div>
    </ToolShell>
  );
}
