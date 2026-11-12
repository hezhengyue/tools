// app/image-background-blur/page.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Download, Trash2, Brush, Eraser, Undo, Redo,
  Settings, Image as ImageIcon, Loader2, Sparkles, Droplets
} from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Notice } from "@/components/ui/ToolUI";

// 资源上限：遮罩与撤销栈都是全尺寸像素，大图必须限制
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_PIXELS = 16_000_000;
const MAX_DIMENSION = 5000;
const MAX_HISTORY = 5; // 每份 ImageData 约 4 字节/像素，控制撤销栈内存

interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export default function ImageBackgroundBlurPage() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [fileName, setFileName] = useState("");
  const [brushSize, setBrushSize] = useState(40);
  const [isEraser, setIsEraser] = useState(false);
  const [blurAmount, setBlurAmount] = useState(15);
  const [featherAmount, setFeatherAmount] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [isHovering, setIsHovering] = useState(false);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // 高频事件里读取最新参数：只在 effect 中同步 ref，不在 render 中赋值
  const brushSizeRef = useRef(brushSize);
  const isEraserRef = useRef(isEraser);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { isEraserRef.current = isEraser; }, [isEraser]);

  // 唯一显示画板 / 内存遮罩画板 / 光标圆圈
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultUrlRef = useRef<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => { resultUrlRef.current = resultUrl; }, [resultUrl]);
  useEffect(() => () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  // 光标位置直接改 DOM，避免 pointermove 每次触发整页重渲染
  const moveCursor = useCallback((clientX: number, clientY: number) => {
    const el = cursorRef.current;
    if (!el) return;
    el.style.left = `${clientX - brushSizeRef.current / 2}px`;
    el.style.top = `${clientY - brushSizeRef.current / 2}px`;
  }, []);

  // 将底图和遮罩实时合成到唯一的展示画板上
  const renderCanvas = useCallback(() => {
    const dCanvas = displayCanvasRef.current;
    const mCanvas = maskCanvasRef.current;
    if (!dCanvas || !mCanvas || !image) return;

    const ctx = dCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, dCanvas.width, dCanvas.height);
    ctx.drawImage(image.source, 0, 0);

    ctx.globalAlpha = 0.45;
    ctx.drawImage(mCanvas, 0, 0);
    ctx.globalAlpha = 1.0;
  }, [image]);

  const loadImage = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setLoadError("请选择图片文件");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setLoadError("图片超过 40MB，请先压缩后再上传");
      return;
    }
    setLoadError("");
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const img = new Image();

    img.onload = () => {
      let source: CanvasImageSource = img;
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      // 超大图先等比缩小，控制遮罩 / 撤销栈内存
      const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h), Math.sqrt(MAX_PIXELS / (w * h)));
      if (scale < 1) {
        const scaled = document.createElement("canvas");
        scaled.width = Math.max(1, Math.floor(w * scale));
        scaled.height = Math.max(1, Math.floor(h * scale));
        const sctx = scaled.getContext("2d");
        if (sctx) {
          sctx.drawImage(img, 0, 0, scaled.width, scaled.height);
          source = scaled;
          w = scaled.width;
          h = scaled.height;
        }
      }

      const mCanvas = document.createElement("canvas");
      mCanvas.width = w;
      mCanvas.height = h;
      maskCanvasRef.current = mCanvas;
      const mCtx = mCanvas.getContext("2d");
      if (mCtx) {
        setHistory([mCtx.getImageData(0, 0, w, h)]);
        setHistoryIndex(0);
      }

      setImage({ source, width: w, height: h });
      setFileName(file.name);
      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      // 图片已解码完成，URL 可立即释放
      URL.revokeObjectURL(url);
      objectUrlRef.current = null;
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      objectUrlRef.current = null;
      setLoadError("图片解码失败，可能格式不受支持或文件已损坏");
    };
    img.src = url;
  }, []);

  // 等待 React 将 <canvas> 渲染到页面上之后，再给它赋宽高并画图
  useEffect(() => {
    if (image && displayCanvasRef.current) {
      displayCanvasRef.current.width = image.width;
      displayCanvasRef.current.height = image.height;
      renderCanvas();
    }
    // resultUrl 变化时画布会重新挂载（结果视图 → 继续编辑），需重绘
  }, [image, renderCanvas, resultUrl]);

  const getCoordinates = useCallback((clientX: number, clientY: number) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }, []);

  const drawStroke = useCallback((clientX: number, clientY: number) => {
    if (!isDrawing.current || !lastPos.current) return;
    const coords = getCoordinates(clientX, clientY);
    if (!coords) return;

    const mCanvas = maskCanvasRef.current;
    const dCanvas = displayCanvasRef.current;
    if (!mCanvas || !dCanvas) return;

    const ctx = mCanvas.getContext("2d");
    if (!ctx) return;

    const rect = dCanvas.getBoundingClientRect();
    const scale = dCanvas.width / rect.width;
    const physicalSize = brushSizeRef.current * scale;

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = physicalSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = isEraserRef.current ? "destination-out" : "source-over";
    ctx.stroke();

    lastPos.current = { x: coords.x, y: coords.y };
    renderCanvas();
  }, [getCoordinates, renderCanvas]);

  const saveHistory = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height));
    if (newHistory.length > MAX_HISTORY) newHistory.shift();

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const applyHistory = useCallback((index: number) => {
    const maskCanvas = maskCanvasRef.current;
    const ctx = maskCanvas?.getContext("2d");
    if (!ctx || !history[index]) return;
    ctx.putImageData(history[index], 0, 0);
    setHistoryIndex(index);
    renderCanvas();
  }, [history, renderCanvas]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawing.current = true;
    moveCursor(e.clientX, e.clientY);
    const coords = getCoordinates(e.clientX, e.clientY);
    if (coords) lastPos.current = { x: coords.x, y: coords.y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    moveCursor(e.clientX, e.clientY);
    if (isDrawing.current) drawStroke(e.clientX, e.clientY);
  };

  const stopDraw = () => {
    if (isDrawing.current) {
      isDrawing.current = false;
      lastPos.current = null;
      saveHistory();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    stopDraw();
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleProcess = async () => {
    if (!image || !maskCanvasRef.current) return;
    setIsProcessing(true);
    // 让浏览器先绘制「生成中」状态
    await new Promise((resolve) => requestAnimationFrame(resolve));

    try {
      const w = image.width;
      const h = image.height;
      const mCanvas = maskCanvasRef.current;

      const outCanvas = document.createElement("canvas");
      outCanvas.width = w;
      outCanvas.height = h;
      const ctx = outCanvas.getContext("2d");
      if (!ctx) throw new Error("无法创建绘图上下文");

      ctx.filter = `blur(${blurAmount * (w / 1000)}px)`;
      ctx.drawImage(image.source, 0, 0, w, h);
      ctx.filter = "none";

      const tempMask = document.createElement("canvas");
      tempMask.width = w;
      tempMask.height = h;
      const tempCtx = tempMask.getContext("2d");
      if (tempCtx) {
        const blurRadius = featherAmount * (w / 1000);
        tempCtx.filter = blurRadius > 0 ? `blur(${blurRadius}px)` : "none";
        tempCtx.drawImage(mCanvas, 0, 0, w, h);
        tempCtx.filter = "none";
      }

      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(tempMask, 0, 0, w, h);
      ctx.globalCompositeOperation = "destination-over";
      ctx.drawImage(image.source, 0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";

      // toBlob 异步编码，比同步的 toDataURL 省内存、不阻塞主线程
      const blob = await new Promise<Blob | null>((resolve) =>
        outCanvas.toBlob(resolve, "image/jpeg", 0.92)
      );
      if (!blob) throw new Error("图片导出失败");
      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch {
      setLoadError("生成失败，请换一张图片或缩小尺寸后重试");
    } finally {
      setIsProcessing(false);
    }
  };

  const backToEdit = () => {
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleReset = () => {
    backToEdit();
    setImage(null);
    setHistory([]);
    setHistoryIndex(-1);
    setLoadError("");
    maskCanvasRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <ToolShell>
      <div className="space-y-5">
        {loadError && <Notice tone="error" className="mb-3">{loadError}</Notice>}

        {!image ? (
          <div
            className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer min-h-[400px] ${
              dragActive ? "border-indigo-500 bg-indigo-50/50 scale-[1.01]" : "border-slate-200 hover:border-slate-400 bg-slate-50/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="上传需要虚化背景的图片"
          >
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" aria-label="选择图片" onChange={(e) => e.target.files?.[0] && loadImage(e.target.files[0])} />
            <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mb-4">
              <ImageIcon size={32} className="text-indigo-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">上传需虚化的图片</h3>
            <p className="text-slate-500 text-sm">拖拽到此处，或点击选择</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 px-2">
                <button onClick={() => setIsEraser(false)} aria-label="画笔" aria-pressed={!isEraser} className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${!isEraser ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                  <Brush size={18} />
                </button>
                <button onClick={() => setIsEraser(true)} aria-label="橡皮擦" aria-pressed={isEraser} className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${isEraser ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                  <Eraser size={18} />
                </button>
                <input type="range" min="10" max="150" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-20 accent-indigo-600 ml-1" />
              </div>

              <div className="w-px h-8 bg-slate-200 mx-1 hidden sm:block" />

              <div className="flex items-center gap-1">
                <button onClick={() => applyHistory(historyIndex - 1)} disabled={historyIndex <= 0} aria-label="撤销" className="ui-icon-btn"><Undo size={18} /></button>
                <button onClick={() => applyHistory(historyIndex + 1)} disabled={historyIndex >= history.length - 1} aria-label="重做" className="ui-icon-btn"><Redo size={18} /></button>
              </div>

              <div className="w-px h-8 bg-slate-200 mx-1 hidden sm:block" />

              <div className="flex items-center gap-4 px-2">
                <div className="flex items-center gap-2" title="背景模糊的强度">
                  <Droplets size={16} className="text-slate-500" />
                  <span className="text-sm text-slate-600 font-medium hidden md:block">模糊</span>
                  <input type="range" min="5" max="50" value={blurAmount} onChange={(e) => setBlurAmount(Number(e.target.value))} className="w-16 accent-indigo-600" />
                </div>
                <div className="flex items-center gap-2" title="画笔边缘的柔和程度，如果不想要边缘柔和可设为0">
                  <Settings size={16} className="text-slate-500" />
                  <span className="text-sm text-slate-600 font-medium hidden md:block">羽化</span>
                  <input type="range" min="0" max="30" value={featherAmount} onChange={(e) => setFeatherAmount(Number(e.target.value))} className="w-16 accent-indigo-600" />
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button onClick={handleReset} aria-label="重置" className="ui-icon-btn text-red-600 hover:bg-red-50"><Trash2 size={18} /></button>
                <button 
                  onClick={handleProcess} 
                  disabled={isProcessing} 
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 text-sm shadow-sm"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {isProcessing ? "生成中..." : resultUrl ? "重新生成" : "生成"}
                </button>
              </div>
            </div>

            {!resultUrl ? (
              <div 
                className="relative w-full h-[65vh] min-h-[400px] bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden touch-none p-4"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => {
                  if (!isDrawing.current) setIsHovering(false);
                }}
              >
                {/* 
                  ✅ 纯正 Canvas 渲染：自动遵循类似 img 标签的缩放机制。
                  100% 拒绝椭圆变形，100% 拒绝任何像素偏移！
                */}
                <canvas
                  ref={displayCanvasRef}
                  className="bg-white drop-shadow-xl pointer-events-none"
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    maxHeight: 'calc(65vh - 2rem)', // 防止超出屏幕
                    width: 'auto',
                    height: 'auto'
                  }}
                />

                {/* 鼠标画笔圆圈定位 */}
                {isHovering && (
                  <div
                    ref={cursorRef}
                    aria-hidden="true"
                    className="fixed pointer-events-none border-2 border-white rounded-full mix-blend-difference z-50"
                    style={{ width: brushSize, height: brushSize, left: -1000, top: -1000 }}
                  />
                )}
                
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/75 text-white/90 px-5 py-2.5 rounded-full text-sm backdrop-blur-md pointer-events-none shadow-lg">
                  💡 涂抹主体区域，背景将自动虚化
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-full h-[65vh] min-h-[400px] bg-slate-100/80 border border-slate-200 rounded-2xl flex items-center justify-center p-4">
                  <img src={resultUrl} alt="背景虚化结果" className="max-w-full max-h-full object-contain drop-shadow-xl rounded-lg" />
                </div>
                <div className="flex justify-center items-center bg-emerald-50 text-emerald-700 px-6 py-4 rounded-2xl border border-emerald-100">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    处理完成，画质已无损保留
                  </div>
                  <button
                    type="button"
                    onClick={backToEdit}
                    className="ui-btn ui-btn-ghost ui-btn-sm ml-4"
                  >
                    继续编辑
                  </button>
                  <a
                    href={resultUrl}
                    download={fileName.replace(/\.\w+$/, "") + "-blur.jpg"}
                    className="ui-btn ui-btn-primary ui-btn-sm ml-2"
                  >
                    <Download size={18} />
                    下载高清图
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        <Notice tone="info">
          涂抹红色区域将保持清晰，其余背景自动虚化。所有处理在本地完成。
        </Notice>
      </div>
    </ToolShell>
  );
}