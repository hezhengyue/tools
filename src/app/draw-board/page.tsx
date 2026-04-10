// app/draw-board/page.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Palette, Eraser, Undo, Redo, Trash2, Download, Maximize2, Minimize2 } from "lucide-react";
import ToolShell from "@/components/ToolShell";

export default function DrawBoardPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 🔧 核心修复：尺寸适配 + 背景白色 + 任意缩放恢复
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. 保存当前画面（物理像素）
    let savedData: ImageData | null = null;
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;
    if (oldWidth > 0 && oldHeight > 0) {
      try { savedData = ctx.getImageData(0, 0, oldWidth, oldHeight); } catch {}
    }

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const newWidth = Math.max(1, Math.floor(rect.width * dpr));
    const newHeight = Math.max(1, Math.floor(rect.height * dpr));
    
    // 2. 重设画布（会清空内容）
    canvas.width = newWidth;
    canvas.height = newHeight;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    // 3. 🔥 关键：先填充白色背景（物理像素坐标，scale 之前）
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, newWidth, newHeight);
    
    // 4. 恢复画面（仍在 scale 之前，用物理像素操作）
    if (savedData && oldWidth > 0 && oldHeight > 0) {
      if (oldWidth === newWidth && oldHeight === newHeight) {
        // 尺寸相同：直接恢复
        ctx.putImageData(savedData, 0, 0);
      } else {
        // 尺寸不同：用临时 canvas 缩放恢复
        const temp = document.createElement("canvas");
        temp.width = oldWidth;
        temp.height = oldHeight;
        const tCtx = temp.getContext("2d");
        if (tCtx) {
          tCtx.putImageData(savedData, 0, 0);
          ctx.drawImage(temp, 0, 0, newWidth, newHeight);
        }
      }
    } else if (history.length === 0) {
      // 首次初始化：保存白色背景状态
      saveState();
    }

    // 5. 设置缩放（后续绘制使用逻辑像素坐标）
    ctx.setTransform(1, 0, 0, 1, 0, 0); // 先重置避免叠加
    ctx.scale(dpr, dpr);

    // 6. 恢复绘制样式
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
  }, [color, brushSize, history.length]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // 保存当前画面到历史（用于撤销/重做）
  const saveState = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (newHistory.length > 30) newHistory.shift();
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // 获取绘制坐标（兼容鼠标/触控）
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // 开始绘制
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  // 绘制中
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = isEraser ? "#ffffff" : color;
    ctx.lineWidth = isEraser ? brushSize * 3 : brushSize;
    ctx.stroke();
  };

  // 结束绘制
  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    canvasRef.current?.getContext("2d")?.closePath();
    saveState();
  };

  // 撤销
  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && history[historyIndex - 1]) {
      ctx.putImageData(history[historyIndex - 1], 0, 0);
      setHistoryIndex(prev => prev - 1);
    }
  };

  // 重做
  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && history[historyIndex + 1]) {
      ctx.putImageData(history[historyIndex + 1], 0, 0);
      setHistoryIndex(prev => prev + 1);
    }
  };

  // 清空画布
  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
  };

  // 下载为 PNG
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `draw-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // 切换全屏
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  // 工具栏组件
  const renderToolbar = () => (
    <div className={`flex flex-wrap items-center gap-3 p-3 bg-white/90 backdrop-blur-sm border-b border-slate-200 ${isFullscreen ? "rounded-none" : "rounded-xl border"}`}>
      <div className="flex items-center gap-2">
        <Palette size={16} className="text-slate-500" />
        <input
          type="color"
          value={color}
          onChange={(e) => { setColor(e.target.value); setIsEraser(false); }}
          className="w-8 h-8 rounded cursor-pointer border-0 p-0"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 hidden sm:inline">粗细</span>
        <input
          type="range"
          min="1"
          max="20"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-20 sm:w-24 accent-indigo-600"
        />
        <span className="text-xs w-6 text-center">{brushSize}</span>
      </div>

      <button
        onClick={() => setIsEraser(!isEraser)}
        className={`p-2 rounded-lg transition-all ${
          isEraser ? "bg-amber-100 text-amber-600 border border-amber-300" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
        }`}
        title="橡皮擦"
      >
        <Eraser size={18} />
      </button>

      <div className="flex items-center gap-1">
        <button
          onClick={handleUndo}
          disabled={historyIndex <= 0}
          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          title="撤销"
        >
          <Undo size={18} />
        </button>
        <button
          onClick={handleRedo}
          disabled={historyIndex >= history.length - 1}
          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          title="重做"
        >
          <Redo size={18} />
        </button>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={handleClear}
          className="p-2 rounded-lg bg-white border border-slate-200 text-red-500 hover:bg-red-50"
          title="清空"
        >
          <Trash2 size={18} />
        </button>
        <button
          onClick={handleDownload}
          className="p-2 rounded-lg bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50"
          title="下载 PNG"
        >
          <Download size={18} />
        </button>
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
          title={isFullscreen ? "退出全屏" : "全屏绘画"}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>
    </div>
  );

  // 全屏模式渲染
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-100 flex flex-col">
        {renderToolbar()}
        <div className="flex-1 relative overflow-hidden" ref={containerRef}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
      </div>
    );
  }

  // 普通模式渲染
  return (
    <ToolShell>
      <div className="space-y-4">
        <div ref={containerRef} className="relative w-full aspect-[4/3] bg-white rounded-2xl border-2 border-slate-200 shadow-inner overflow-hidden">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
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

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-sm text-slate-600">
          <strong>📌 提示：</strong>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>支持鼠标与触屏绘画，自动适配高清屏</li>
            <li>缩放/全屏时画面自动保留，背景始终为白色</li>
            <li>历史记录最多保留 30 步，防止内存占用</li>
            <li>纯前端运行，所有数据仅保存在本地</li>
          </ul>
        </div>
      </div>
    </ToolShell>
  );
}