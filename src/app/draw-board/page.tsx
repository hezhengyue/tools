"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Palette,
  Eraser,
  Undo,
  Redo,
  Trash2,
  Download,
} from "lucide-react";
import ToolShell from "@/components/ToolShell";

type Point = { x: number; y: number };

type Path = {
  points: Point[];
  color: string;
  width: number;
  erase: boolean;
};

export default function DrawBoardPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pathsRef = useRef<Path[]>([]);
  const redoRef = useRef<Path[]>([]);
  const isDrawingRef = useRef(false);
  const isTouchRef = useRef(false);

  const dprRef = useRef(1);

  const toolRef = useRef({
    color: "#000000",
    width: 5,
    erase: false,
  });

  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [isEraser, setIsEraser] = useState(false);
    const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // 白底
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);

    const paths = pathsRef.current;

    for (const path of paths) {
      if (!path || path.points.length === 0) continue;

      ctx.save();

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = path.width;

      if (path.erase) {
        ctx.strokeStyle = "#ffffff";
        ctx.fillStyle = "#ffffff";
      } else {
        ctx.strokeStyle = path.color;
        ctx.fillStyle = path.color;
      }

      const pts = path.points;

      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, path.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);

      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }

      ctx.stroke();
      ctx.restore();
    }
  }, []);
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

    // 坐标统一
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    redraw();
  }, [redraw]);

  useEffect(() => {
    initCanvas();
    window.addEventListener("resize", initCanvas);
    return () => window.removeEventListener("resize", initCanvas);
  }, [initCanvas]);
    const getPos = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    const clientX =
      "touches" in e ? e.touches[0].clientX : e.clientX;

    const clientY =
      "touches" in e ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: any) => {
    if (e.type === "touchstart") e.preventDefault();

    isTouchRef.current = e.type === "touchstart";

    const p = getPos(e);

    toolRef.current = {
      color,
      width: brushSize,
      erase: isEraser,
    };

    pathsRef.current.push({
      points: [p],
      ...toolRef.current,
    });

    redoRef.current = [];
    isDrawingRef.current = true;

    redraw();
  };

  const draw = (e: any) => {
    if (!isDrawingRef.current) return;

    if (e.type === "mousemove" && isTouchRef.current) return;

    e.preventDefault();

    const p = getPos(e);

    const current = pathsRef.current[pathsRef.current.length - 1];
    if (!current) return;

    current.points.push(p);

    redraw();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    isTouchRef.current = false;
  };
    const undo = () => {
    const last = pathsRef.current.pop();
    if (last) redoRef.current.push(last);
    redraw();
  };

  const redo = () => {
    const last = redoRef.current.pop();
    if (last) pathsRef.current.push(last);
    redraw();
  };

  const clear = () => {
    pathsRef.current = [];
    redoRef.current = [];
    redraw();
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const exportCanvas = document.createElement("canvas");

    const dpr = dprRef.current;

    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;

    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    ctx.drawImage(canvas, 0, 0);

    const a = document.createElement("a");
    a.download = `draw-${Date.now()}.png`;
    a.href = exportCanvas.toDataURL("image/png");
    a.click();
  };
    const renderToolbar = () => (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-white border rounded-xl relative z-50">
      <div className="flex items-center gap-2">
        <Palette size={16} />
        <input
          type="color"
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            setIsEraser(false);
          }}
        />
      </div>

      <input
        type="range"
        min="1"
        max="20"
        value={brushSize}
        onChange={(e) => setBrushSize(Number(e.target.value))}
      />

      <button
        onClick={() => setIsEraser((v) => !v)}
        className={`p-2 rounded-lg transition ${
          isEraser
            ? "bg-red-500 text-white"
            : "bg-white text-slate-600"
        }`}
      >
        <Eraser size={18} />
      </button>

      <button onClick={undo}>
        <Undo size={18} />
      </button>

      <button onClick={redo}>
        <Redo size={18} />
      </button>

      <button onClick={clear}>
        <Trash2 size={18} />
      </button>

      <button onClick={download}>
        <Download size={18} />
      </button>
    </div>
  );
    return (
    <ToolShell>
      <div className="space-y-4">
        <div
          ref={containerRef}
          className="relative w-full aspect-[4/3] bg-white border rounded-2xl overflow-hidden"
        >
          <canvas
            ref={canvasRef}
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

        {renderToolbar()}
      </div>
    </ToolShell>
  );
}