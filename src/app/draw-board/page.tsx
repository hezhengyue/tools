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

  // 初始化与尺寸适配（缩放时保存/恢复画面）
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 保存当前画面（防缩放丢失）
    let savedData: ImageData | null = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try { savedData = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch {}
    }

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // 重设画布实际像素（会清空内容，需恢复）
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    // 恢复画面或初始化白色背景
    if (savedData) {
      ctx.putImageData(savedData, 0, 0);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (history.length === 0) saveState();
    }

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
    if (newHistory.length > 30) newHistory.shift(); // 限制最多 30 步
    
    setHistory(newHistory);
    setHistoryIndex(Math.min(newHistory.length - 1, 29));
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
      {/* 颜色选择 */}
      <div className="flex items-center gap-2">
        <Palette size={16} className="text-slate-500" />
        <input
          type="color"
          value={color}
          onChange={(e) => { setColor(e.target.value); setIsEraser(false); }}
          className="w-8 h-8 rounded cursor-pointer border-0 p-0"
        />
      </div>

      {/* 笔刷粗细 */}
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

      {/* 橡皮擦 */}
      <button
        onClick={() => setIsEraser(!isEraser)}
        className={`p-2 rounded-lg transition-all ${
          isEraser ? "bg-amber-100 text-amber-600 border border-amber-300" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
        }`}
        title="橡皮擦"
      >
        <Eraser size={18} />
      </button>

      {/* 撤销/重做 */}
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

      {/* 右侧操作 */}
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
        {/* 画板容器 */}
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

        {/* 工具栏 */}
        {renderToolbar()}

        {/* 使用说明 */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-sm text-slate-600">
          <strong>📌 提示：</strong>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>支持鼠标与触屏绘画，自动适配高清屏</li>
            <li>缩放页面或切换全屏时，画面自动保留不丢失</li>
            <li>历史记录最多保留 30 步，防止内存占用</li>
            <li>纯前端运行，所有数据仅保存在本地</li>
          </ul>
        </div>
      </div>
    </ToolShell>
  );
}