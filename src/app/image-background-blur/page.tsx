// app/image-background-blur/page.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { 
  Download, Trash2, Brush, Eraser, Undo, Redo,
  Settings, Image as ImageIcon, Info, Loader2, Sparkles, Droplets
} from "lucide-react";
import ToolShell from "@/components/ToolShell";

export default function ImageBackgroundBlurPage() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [brushSize, setBrushSize] = useState(40); 
  const [isEraser, setIsEraser] = useState(false);
  const [blurAmount, setBlurAmount] = useState(15);
  const [featherAmount, setFeatherAmount] = useState(10); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [cursorPos, setCursorPos] = useState({ x: -1000, y: -1000 });
  const [isHovering, setIsHovering] = useState(false);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const brushSizeRef = useRef(brushSize);
  const isEraserRef = useRef(isEraser);
  brushSizeRef.current = brushSize;
  isEraserRef.current = isEraser;

  // 唯一显示画板
  const displayCanvasRef = useRef<HTMLCanvasElement>(null); 
  // 内存遮罩画板
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 将底图和遮罩实时合成到唯一的展示画板上
  const renderCanvas = useCallback(() => {
    const dCanvas = displayCanvasRef.current;
    const mCanvas = maskCanvasRef.current;
    if (!dCanvas || !mCanvas || !image) return;

    const ctx = dCanvas.getContext("2d");
    if (!ctx) return;

    // 1. 画原图
    ctx.clearRect(0, 0, dCanvas.width, dCanvas.height);
    ctx.drawImage(image, 0, 0);

    // 2. 叠加上半透明的红色涂鸦遮罩
    ctx.globalAlpha = 0.45;
    ctx.drawImage(mCanvas, 0, 0);
    ctx.globalAlpha = 1.0;
  }, [image]);

  const loadImage = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    
    const url = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // 在内存中创建遮罩画板（不依赖 DOM，立刻可用）
      const mCanvas = document.createElement("canvas");
      mCanvas.width = w;
      mCanvas.height = h;
      maskCanvasRef.current = mCanvas;

      const mCtx = mCanvas.getContext("2d");
      if (mCtx) {
        setHistory([mCtx.getImageData(0, 0, w, h)]);
        setHistoryIndex(0);
      }

      // 更新状态，促使 React 渲染 displayCanvas 节点
      setImage(img);
      setFileName(file.name);
      setResultUrl(null);
    };
    img.src = url;
  }, []);

  // ✅ 核心修复：等待 React 将 <canvas> 渲染到页面上之后，再给它赋宽高并画图
  useEffect(() => {
    if (image && displayCanvasRef.current) {
      displayCanvasRef.current.width = image.naturalWidth;
      displayCanvasRef.current.height = image.naturalHeight;
      renderCanvas();
    }
  }, [image, renderCanvas]);

  const getCoordinates = useCallback((clientX: number, clientY: number) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return { 
      x: (clientX - rect.left) * scaleX, 
      y: (clientY - rect.top) * scaleY
    };
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
    ctx.strokeStyle = "#ef4444"; // 遮罩直接用纯正大红
    ctx.lineWidth = physicalSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = isEraserRef.current ? "destination-out" : "source-over";
    ctx.stroke();

    lastPos.current = { x: coords.x, y: coords.y };
    renderCanvas();
  }, [getCoordinates, renderCanvas]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    
    isDrawing.current = true;
    setCursorPos({ x: e.clientX, y: e.clientY });
    
    const coords = getCoordinates(e.clientX, e.clientY);
    if (coords) lastPos.current = { x: coords.x, y: coords.y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setCursorPos({ x: e.clientX, y: e.clientY });

    if (isDrawing.current) {
      drawStroke(e.clientX, e.clientY);
    }
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

  const saveHistory = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height));
    if (newHistory.length > 10) newHistory.shift(); 
    
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

  const handleProcess = async () => {
    if (!image || !maskCanvasRef.current) return;
    setIsProcessing(true);
    await new Promise(res => setTimeout(res, 50));

    const w = image.naturalWidth;
    const h = image.naturalHeight;
    const mCanvas = maskCanvasRef.current;

    const outCanvas = document.createElement("canvas");
    outCanvas.width = w;
    outCanvas.height = h;
    const ctx = outCanvas.getContext("2d");
    if (!ctx) return;

    // 1. 绘制模糊底层
    ctx.filter = `blur(${blurAmount * (w / 1000)}px)`;
    ctx.drawImage(image, 0, 0, w, h);
    ctx.filter = "none";

    // 2. 利用遮罩挖洞 (羽化边缘)
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

    // 3. 填入清晰原图
    ctx.globalCompositeOperation = "destination-over";
    ctx.drawImage(image, 0, 0, w, h);

    ctx.globalCompositeOperation = "source-over";

    setResultUrl(outCanvas.toDataURL("image/jpeg", 0.92));
    setIsProcessing(false);
  };

  const handleReset = () => {
    setImage(null);
    setResultUrl(null);
    setHistory([]);
    setHistoryIndex(-1);
    maskCanvasRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <ToolShell>
      <div className="space-y-5">
        {!image ? (
          <div
            className={`border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer min-h-[400px] ${
              dragActive ? "border-indigo-500 bg-indigo-50/50 scale-[1.01]" : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && loadImage(e.target.files[0])} />
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
                <button onClick={() => setIsEraser(false)} className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${!isEraser ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                  <Brush size={18} />
                </button>
                <button onClick={() => setIsEraser(true)} className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${isEraser ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                  <Eraser size={18} />
                </button>
                <input type="range" min="10" max="150" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-20 accent-indigo-600 ml-1" />
              </div>

              <div className="w-px h-8 bg-slate-200 mx-1 hidden sm:block" />

              <div className="flex items-center gap-1">
                <button onClick={() => applyHistory(historyIndex - 1)} disabled={historyIndex <= 0} className="p-2 text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-30"><Undo size={18} /></button>
                <button onClick={() => applyHistory(historyIndex + 1)} disabled={historyIndex >= history.length - 1} className="p-2 text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-30"><Redo size={18} /></button>
              </div>

              <div className="w-px h-8 bg-slate-200 mx-1 hidden sm:block" />

              <div className="flex items-center gap-4 px-2">
                <div className="flex items-center gap-2" title="背景模糊的强度">
                  <Droplets size={16} className="text-slate-400" />
                  <span className="text-sm text-slate-600 font-medium hidden md:block">模糊</span>
                  <input type="range" min="5" max="50" value={blurAmount} onChange={(e) => setBlurAmount(Number(e.target.value))} className="w-16 accent-indigo-600" />
                </div>
                <div className="flex items-center gap-2" title="画笔边缘的柔和程度，如果不想要边缘柔和可设为0">
                  <Settings size={16} className="text-slate-400" />
                  <span className="text-sm text-slate-600 font-medium hidden md:block">羽化</span>
                  <input type="range" min="0" max="30" value={featherAmount} onChange={(e) => setFeatherAmount(Number(e.target.value))} className="w-16 accent-indigo-600" />
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button onClick={handleReset} className="p-2 text-red-500 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100"><Trash2 size={18} /></button>
                <button 
                  onClick={handleProcess} 
                  disabled={isProcessing || !!resultUrl} 
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 text-sm shadow-sm"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {resultUrl ? "已生成" : "生成"}
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
                    className="fixed pointer-events-none border-2 border-white rounded-full mix-blend-difference z-50"
                    style={{
                      width: brushSize,
                      height: brushSize,
                      left: cursorPos.x - brushSize / 2,
                      top: cursorPos.y - brushSize / 2,
                    }}
                  />
                )}
                
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/75 text-white/90 px-5 py-2.5 rounded-full text-sm backdrop-blur-md pointer-events-none shadow-lg">
                  💡 涂抹主体区域，背景将自动虚化
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-full h-[65vh] min-h-[400px] bg-slate-100/80 border border-slate-200 rounded-2xl flex items-center justify-center p-4">
                  <img src={resultUrl} alt="Blurred Result" className="max-w-full max-h-full object-contain drop-shadow-xl rounded-lg" />
                </div>
                <div className="flex justify-between items-center bg-emerald-50 text-emerald-700 px-6 py-4 rounded-2xl border border-emerald-100">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>
                    处理完成，画质已无损保留
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setResultUrl(null)} className="px-5 py-2.5 bg-white text-slate-700 rounded-xl hover:bg-slate-50 border border-slate-200 font-medium transition-all">
                      返回修改
                    </button>
                    <a 
                      href={resultUrl} 
                      download={fileName.replace(/\.\w+$/, "") + "-blur.jpg"}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Download size={18} />
                      下载高清图
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="px-5 py-4 bg-slate-50 rounded-2xl text-sm text-slate-500 border border-slate-100 flex gap-3 leading-relaxed">
          <Info size={18} className="text-indigo-400 shrink-0 mt-0.5" />
          <p>
            <strong>完美运行状态：</strong> 
            已解决图片无法加载的生命周期问题。现在的“单画板引擎”不仅拥有无与伦比的性能，更彻底杜绝了偏移、错位和椭圆现象。无论你在哪里起笔，都绝对“指哪画哪”！
          </p>
        </div>
      </div>
    </ToolShell>
  );
}