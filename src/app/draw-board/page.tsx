"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Palette,
  Eraser,
  Undo,
  Redo,
  Trash2,
  Download,
} from "lucide-react";
import ToolShell from "@/components/ToolShell";

type Point = {
  x: number;
  y: number;
};

type Path = {
  points: Point[];
  color: string;
  width: number;
  erase: boolean;
};

/** 鼠标 / 触摸事件的公共形态 */
type DrawEvent =
  | React.MouseEvent<HTMLCanvasElement>
  | React.TouchEvent<HTMLCanvasElement>;

export default function DrawBoardPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pathsRef = useRef<Path[]>([]);
  const redoRef = useRef<Path[]>([]);

  const isDrawingRef = useRef(false);
  const isTouchRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const dprRef = useRef(1);

  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [isEraser, setIsEraser] = useState(false);

  const toolRef = useRef({
    color: "#000000",
    width: 5,
    erase: false,
  });

  /**
   * 重绘全部路径
   */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    ctx.clearRect(0, 0, width, height);

    // 白色背景
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    for (const path of pathsRef.current) {
      if (!path.points.length) continue;

      ctx.save();

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = path.width;

      if (path.erase) {
        ctx.globalCompositeOperation = "destination-out";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = path.color;
        ctx.fillStyle = path.color;
      }

      if (path.points.length === 1) {
        const p = path.points[0];

        ctx.beginPath();
        ctx.arc(p.x, p.y, path.width / 2, 0, Math.PI * 2);

        if (path.erase) {
          ctx.fillStyle = "#000";
        }

        ctx.fill();
        ctx.restore();

        continue;
      }

      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);

      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }

      ctx.stroke();
      ctx.restore();
    }
  }, []);

  /** 把高频 pointermove 的重绘合并到每帧一次 */
  const scheduleRedraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      redraw();
    });
  }, [redraw]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  /**
   * 初始化画布
   */
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();

    const dpr = window.devicePixelRatio || 1;

    dprRef.current = dpr;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    redraw();
  }, [redraw]);

  useEffect(() => {
    initCanvas();

    window.addEventListener("resize", initCanvas);

    return () => {
      window.removeEventListener("resize", initCanvas);
    };
  }, [initCanvas]);

  /**
   * 手机绘制时禁止页面滚动
   */
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const prevent = (e: TouchEvent) => {
      if (isDrawingRef.current) {
        e.preventDefault();
      }
    };

    canvas.addEventListener("touchmove", prevent, {
      passive: false,
    });

    return () => {
      canvas.removeEventListener("touchmove", prevent);
    };
  }, []);

  /**
   * 获取坐标
   */
  const getPos = (e: DrawEvent): Point => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect = canvas.getBoundingClientRect();

    const clientX = "touches" in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
    const clientY = "touches" in e ? (e.touches[0]?.clientY ?? 0) : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  /**
   * 开始绘制
   */
  const startDrawing = (e: DrawEvent) => {
    if (e.type === "touchstart") {
      e.preventDefault();
    }

    isTouchRef.current = e.type === "touchstart";

    toolRef.current = {
      color,
      width: brushSize,
      erase: isEraser,
    };

    const point = getPos(e);

    pathsRef.current.push({
      points: [point],
      color: toolRef.current.color,
      width: toolRef.current.width,
      erase: toolRef.current.erase,
    });

    redoRef.current = [];

    isDrawingRef.current = true;

    redraw();
  };

  /**
   * 绘制中
   */
  const draw = (e: DrawEvent) => {
    if (!isDrawingRef.current) return;

    if (e.type === "mousemove" && isTouchRef.current) {
      return;
    }

    e.preventDefault();

    const current = pathsRef.current[pathsRef.current.length - 1];

    if (!current) return;

    current.points.push(getPos(e));

    scheduleRedraw();
  };

  /**
   * 停止绘制
   */
  const stopDrawing = () => {
    isDrawingRef.current = false;
    isTouchRef.current = false;
  };
    /**
   * 撤销
   */
  const undo = () => {
    const last = pathsRef.current.pop();

    if (last) {
      redoRef.current.push(last);
    }

    redraw();
  };

  /**
   * 重做
   */
  const redo = () => {
    const last = redoRef.current.pop();

    if (last) {
      pathsRef.current.push(last);
    }

    redraw();
  };

  /**
   * 清空
   */
  const clear = () => {
    pathsRef.current = [];
    redoRef.current = [];
    redraw();
  };

  /**
   * 下载
   */
  const download = () => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const exportCanvas = document.createElement("canvas");

    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;

    const ctx = exportCanvas.getContext("2d");

    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    ctx.drawImage(canvas, 0, 0);

    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `draw-${Date.now()}.png`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }, "image/png");
  };

  /**
   * 工具栏
   */
  const renderToolbar = () => (
    <div
      className="
        inline-flex
        flex-wrap
        items-center
        gap-3
        p-3
        bg-white
        border
        border-slate-200
        rounded-xl
        shadow-sm
      "
    >
      <div className="flex items-center gap-2">
        <Palette size={16} />

        <input
          type="color"
          aria-label="画笔颜色"
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            setIsEraser(false);
          }}
          className="w-8 h-8 cursor-pointer border-0 bg-transparent"
        />
      </div>

      <input
        type="range"
        aria-label="画笔粗细"
        min={1}
        max={20}
        value={brushSize}
        onChange={(e) => setBrushSize(Number(e.target.value))}
      />

      <button
        type="button"
        onClick={() => setIsEraser((v) => !v)}
        aria-label="橡皮擦"
        aria-pressed={isEraser}
        className={`p-2 rounded-lg transition ${
          isEraser
            ? "bg-red-500 text-white"
            : "hover:bg-slate-100 text-slate-600"
        }`}
      >
        <Eraser size={18} />
      </button>

      <button
        type="button"
        onClick={undo}
        aria-label="撤销"
        className="ui-icon-btn"
      >
        <Undo size={18} />
      </button>

      <button
        type="button"
        onClick={redo}
        aria-label="重做"
        className="ui-icon-btn"
      >
        <Redo size={18} />
      </button>

      <button
        type="button"
        onClick={clear}
        aria-label="清空"
        className="ui-icon-btn"
      >
        <Trash2 size={18} />
      </button>

      <button
        type="button"
        onClick={download}
        aria-label="下载图片"
        className="ui-icon-btn"
      >
        <Download size={18} />
      </button>
    </div>
  );

  return (
    <ToolShell>
      <div className="flex flex-col gap-4">

        {/* Canvas */}
        <div
          ref={containerRef}
          className="
            relative
            w-full
            aspect-[4/3]
            bg-white
            border
            border-slate-200
            rounded-2xl
            overflow-hidden
            select-none
          "
        >
          <canvas
            ref={canvasRef}
            aria-label="绘图画布，可用鼠标或手指绘制"
            className="absolute inset-0 w-full h-full touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>

        {/* Toolbar */}
        <div className="flex justify-center">
          {renderToolbar()}
        </div>

      </div>
    </ToolShell>
  );
}