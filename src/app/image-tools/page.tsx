// app/image-tools/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import {
  Crop, Download, Droplets, FileImage, Grid3x3, ImagePlus, Layers3,
  RefreshCw, ScanLine, Stamp, Upload,
} from "lucide-react";
import ToolShell from "@/components/ToolShell";
import {
  Button, EmptyState, Notice, Panel, Segmented, Switch,
} from "@/components/ui/ToolUI";
import {
  baseName, buildIco, canvasToBlob, downloadBlob, drawRounded,
  drawWatermark, formatBytes, loadImageFile, MAX_FILE_SIZE, renderSquare,
  sliceGrid, svgToPng, type ImageSource, type WatermarkPosition,
} from "./image-utils";

type Mode = "watermark" | "round" | "grid" | "ico" | "svg";

const MODE_OPTIONS: { value: Mode; label: string; icon: typeof Stamp }[] = [
  { value: "watermark", label: "文字水印", icon: Stamp },
  { value: "round", label: "圆角裁剪", icon: Crop },
  { value: "grid", label: "九宫格切图", icon: Grid3x3 },
  { value: "ico", label: "ICO / favicon", icon: Layers3 },
  { value: "svg", label: "SVG 转 PNG", icon: ScanLine },
];

const ICO_SIZES = [16, 32, 48, 64, 128, 256];

const SVG_SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <rect width="120" height="120" rx="24" fill="#4f46e5"/>
  <circle cx="60" cy="60" r="30" fill="#ffffff" opacity="0.92"/>
  <path d="M46 60 l10 10 l20 -22" fill="none" stroke="#4f46e5" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/* ---------------- 通用组件 ---------------- */

function UploadArea({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="点击、拖入或粘贴图片"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={`flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
        dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-slate-50 hover:border-indigo-300"
      }`}
    >
      <Upload size={28} className="text-indigo-500" strokeWidth={1.6} />
      <p className="text-sm font-semibold text-slate-700">点击选择、拖入图片，或直接 Ctrl/⌘+V 粘贴</p>
      <p className="text-xs text-slate-500">PNG / JPG / WebP / GIF / SVG · 最大 {formatBytes(MAX_FILE_SIZE)} · 1600 万像素以内</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.svg"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function SourcePreview({
  source, onReplace, onClear,
}: { source: ImageSource; onReplace: () => void; onClear: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
      <img src={source.url} alt="原图预览" className="w-20 h-20 object-contain rounded-lg bg-white border border-slate-200" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-700 truncate">{source.name}</div>
        <div className="text-xs text-slate-500 mt-1">
          {source.img.naturalWidth || "—"} × {source.img.naturalHeight || "—"} px · {formatBytes(source.size)}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onReplace}>更换图片</Button>
        <Button variant="ghost" size="sm" onClick={onClear}>移除</Button>
      </div>
    </div>
  );
}

/** 生成结果后的统一预览 + 下载（图片文件导出属于整页动作，用 Button） */
function ImageResult({ blob, filename, hint }: { blob: Blob | null; filename: string; hint?: string }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!blob) {
      queueMicrotask(() => setUrl(""));
      return;
    }
    const next = URL.createObjectURL(blob);
    queueMicrotask(() => setUrl(next));
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  if (!blob) return <EmptyState>{hint ?? "设置参数后点「生成预览」查看结果"}</EmptyState>;

  return (
    <div>
      <div className="ui-display p-4 flex items-center justify-center min-h-[160px]">
        {url && <img src={url} alt="处理结果预览" className="max-w-full max-h-[360px] object-contain rounded-lg" />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <span className="text-xs text-slate-500">输出 {formatBytes(blob.size)}</span>
        <Button icon={Download} onClick={() => downloadBlob(blob, filename)}>下载 {filename}</Button>
      </div>
    </div>
  );
}

function NeedImage() {
  return <Notice tone="info">请先在上方上传一张图片。</Notice>;
}

/* ---------------- 文字水印 ---------------- */

const POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: "tl", label: "左上" }, { value: "tc", label: "上中" }, { value: "tr", label: "右上" },
  { value: "ml", label: "左中" }, { value: "mc", label: "正中" }, { value: "mr", label: "右中" },
  { value: "bl", label: "左下" }, { value: "bc", label: "下中" }, { value: "br", label: "右下" },
];

function WatermarkPanel({ source }: { source: ImageSource | null }) {
  const [text, setText] = useState("正月工具箱 · 仅供演示");
  const [color, setColor] = useState("#ffffff");
  const [opacity, setOpacity] = useState(60);
  const [scale, setScale] = useState(4);
  const [position, setPosition] = useState<WatermarkPosition>("br");
  const [tiled, setTiled] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      const canvas = drawWatermark(source.img, {
        text: text || " ", color, opacity: opacity / 100, scale, position, tiled, rotation,
      });
      setBlob(await canvasToBlob(canvas));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel icon={Droplets} title="水印参数">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="wm-text" className="ui-label text-sm block mb-2">水印文字</label>
          <input id="wm-text" value={text} onChange={(event) => setText(event.target.value)} className="ui-input" />
        </div>
        <div>
          <label htmlFor="wm-color" className="ui-label text-sm block mb-2">文字颜色</label>
          <div className="flex items-center gap-2">
            <input id="wm-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="w-11 h-11 p-1 bg-white border border-slate-200 rounded-xl cursor-pointer" />
            <span className="font-mono text-sm text-slate-600">{color.toUpperCase()}</span>
          </div>
        </div>
        <div>
          <label htmlFor="wm-opacity" className="ui-label text-sm block mb-2">不透明度 {opacity}%</label>
          <input id="wm-opacity" type="range" min={5} max={100} value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} className="w-full accent-indigo-600" />
        </div>
        <div>
          <label htmlFor="wm-scale" className="ui-label text-sm block mb-2">字号（占图宽 {scale}%）</label>
          <input id="wm-scale" type="range" min={1} max={15} value={scale} onChange={(event) => setScale(Number(event.target.value))} className="w-full accent-indigo-600" />
        </div>
      </div>

      <div className="mt-4">
        <span className="ui-label text-sm block mb-2">位置（平铺时忽略）</span>
        <div className="grid grid-cols-3 gap-1 max-w-[240px]">
          {POSITIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              disabled={tiled}
              aria-pressed={position === item.value}
              onClick={() => setPosition(item.value)}
              className={`py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-40 ${
                position === item.value ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5 mt-4">
        <Switch id="wm-tiled" checked={tiled} onChange={setTiled} label="平铺整个画面" />
        <label htmlFor="wm-rotation" className="flex items-center gap-2 text-sm text-slate-600">
          旋转
          <input id="wm-rotation" type="number" min={-90} max={90} value={rotation} onChange={(event) => setRotation(Math.max(-90, Math.min(90, Number(event.target.value))))} className="ui-input ui-input-sm w-20 font-mono" />
          度
        </label>
      </div>

      <div className="mt-4">
        <Button icon={Stamp} disabled={!source || busy} onClick={generate}>{busy ? "生成中…" : "生成预览"}</Button>
      </div>
      {error && <Notice tone="error" className="mt-3">{error}</Notice>}
      {!source && <div className="mt-3"><NeedImage /></div>}
      <div className="mt-4">
        <ImageResult blob={blob} filename={source ? `${baseName(source.name)}-watermark.png` : "watermark.png"} />
      </div>
    </Panel>
  );
}

/* ---------------- 圆角裁剪 ---------------- */

function RoundPanel({ source }: { source: ImageSource | null }) {
  const [radius, setRadius] = useState(16);
  const [white, setWhite] = useState(false);
  const [square, setSquare] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      setBlob(await canvasToBlob(drawRounded(source.img, radius, white, square)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel icon={Crop} title="圆角参数">
      <label htmlFor="round-radius" className="ui-label text-sm block mb-2">圆角半径 {radius}%（按短边计算）</label>
      <input id="round-radius" type="range" min={0} max={50} value={radius} onChange={(event) => setRadius(Number(event.target.value))} className="w-full accent-indigo-600" />
      <div className="flex flex-wrap items-center gap-5 mt-4">
        <Switch id="round-white" checked={white} onChange={setWhite} label="白色背景（关闭则透明）" />
        <Switch id="round-square" checked={square} onChange={setSquare} label="居中裁成正方形" />
      </div>
      <div className="mt-4"><Button icon={Crop} disabled={!source || busy} onClick={generate}>{busy ? "生成中…" : "生成预览"}</Button></div>
      {error && <Notice tone="error" className="mt-3">{error}</Notice>}
      {!source && <div className="mt-3"><NeedImage /></div>}
      <div className="mt-4">
        <ImageResult blob={blob} filename={source ? `${baseName(source.name)}-rounded.png` : "rounded.png"} hint="透明区域在预览中显示为棋盘格或白底，导出 PNG 会保留 alpha 通道" />
      </div>
    </Panel>
  );
}

/* ---------------- 九宫格切图 ---------------- */

function GridPanel({ source }: { source: ImageSource | null }) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      const cells = sliceGrid(source.img, rows, cols);
      const zip = new JSZip();
      const name = baseName(source.name);
      for (let index = 0; index < cells.length; index += 1) {
        const row = Math.floor(index / cols) + 1;
        const col = (index % cols) + 1;
        zip.file(`${name}_r${row}c${col}.png`, await canvasToBlob(cells[index]));
      }
      setBlob(await zip.generateAsync({ type: "blob" }));
      setCount(cells.length);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "切图失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel icon={Grid3x3} title="切图设置">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <span className="ui-label text-sm block mb-2">行数</span>
          <Segmented label="切图行数" value={String(rows)} options={[2, 3, 4].map((n) => ({ value: String(n), label: `${n} 行` }))} onChange={(next) => setRows(Number(next))} />
        </div>
        <div>
          <span className="ui-label text-sm block mb-2">列数</span>
          <Segmented label="切图列数" value={String(cols)} options={[2, 3, 4].map((n) => ({ value: String(n), label: `${n} 列` }))} onChange={(next) => setCols(Number(next))} />
        </div>
      </div>

      {source && (
        <div className="relative mt-4 rounded-xl overflow-hidden border border-slate-200 bg-white">
          <img src={source.url} alt="切图预览" className="w-full max-h-[360px] object-contain" />
          <div
            className="absolute inset-0 grid pointer-events-none"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
          >
            {Array.from({ length: rows * cols }, (_, index) => (
              <div key={index} className="border border-dashed border-white/80 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]" />
            ))}
          </div>
        </div>
      )}

      <div className="mt-4"><Button icon={Grid3x3} disabled={!source || busy} onClick={generate}>{busy ? "生成中…" : `生成 ${rows * cols} 张并打包`}</Button></div>
      {error && <Notice tone="error" className="mt-3">{error}</Notice>}
      {!source && <div className="mt-3"><NeedImage /></div>}
      {blob && (
        <div className="mt-4">
          <Notice tone="success">已生成 {count} 张 PNG，打包为一个 ZIP 文件。</Notice>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <span className="text-xs text-slate-500">压缩包 {formatBytes(blob.size)}</span>
            <Button icon={Download} onClick={() => downloadBlob(blob, `${source ? baseName(source.name) : "image"}-grid.zip`)}>下载 ZIP</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- ICO / favicon ---------------- */

function IcoPanel({ source }: { source: ImageSource | null }) {
  const [sizes, setSizes] = useState<number[]>([16, 32, 48, 64, 128, 256]);
  const [ico, setIco] = useState<Blob | null>(null);
  const [zip, setZip] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggle = (size: number) => {
    setSizes((prev) => prev.includes(size) ? prev.filter((item) => item !== size) : [...prev, size].sort((a, b) => a - b));
  };

  const generate = async () => {
    if (!source || sizes.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const archive = new JSZip();
      for (const size of sizes) {
        archive.file(`favicon-${size}x${size}.png`, await renderSquare(source.img, size));
      }
      setIco(await buildIco(source.img, sizes));
      setZip(await archive.generateAsync({ type: "blob" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel icon={Layers3} title="图标尺寸">
      <p className="text-sm text-slate-600 mb-3">源图会先居中裁成正方形，再缩放为所选尺寸；ICO 内嵌 PNG（Vista 及以上、所有现代浏览器支持）。</p>
      <div className="flex flex-wrap gap-2">
        {ICO_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            aria-pressed={sizes.includes(size)}
            onClick={() => toggle(size)}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors ${
              sizes.includes(size) ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-600"
            }`}
          >
            {size}×{size}
          </button>
        ))}
      </div>
      <div className="mt-4"><Button icon={Layers3} disabled={!source || busy || sizes.length === 0} onClick={generate}>{busy ? "生成中…" : "生成 ICO 与 favicon 套件"}</Button></div>
      {error && <Notice tone="error" className="mt-3">{error}</Notice>}
      {!source && <div className="mt-3"><NeedImage /></div>}
      {ico && zip && (
        <div className="mt-4 space-y-3">
          <Notice tone="success">已生成 {sizes.length} 个尺寸的图标，ICO 内含全部尺寸，ZIP 为独立的 PNG 文件。</Notice>
          <div className="flex flex-wrap gap-3">
            <Button icon={Download} onClick={() => downloadBlob(ico, `${source ? baseName(source.name) : "favicon"}.ico`)}>下载 ICO（{formatBytes(ico.size)}）</Button>
            <Button variant="secondary" icon={Download} onClick={() => downloadBlob(zip, "favicon-png.zip")}>下载 PNG 套件（{formatBytes(zip.size)}）</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- SVG 转 PNG ---------------- */

function SvgPanel() {
  const [text, setText] = useState(SVG_SAMPLE);
  const [width, setWidth] = useState(512);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      setBlob(await svgToPng(text, width));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "转换失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel icon={ScanLine} title="SVG 源码">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-xs text-slate-500">支持 viewBox / width / height，外链图片与字体可能受浏览器安全策略限制</span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={FileImage} onClick={() => fileRef.current?.click()}>上传 .svg</Button>
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => setText(SVG_SAMPLE)}>恢复示例</Button>
          <input
            ref={fileRef}
            type="file"
            accept=".svg,image/svg+xml"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                if (file.size > 2 * 1024 * 1024) setError("SVG 文件超过 2 MB，请精简后再上传");
                else setText(await file.text());
              }
              event.target.value = "";
            }}
          />
        </div>
      </div>
      <textarea
        id="svg-source"
        value={text}
        onChange={(event) => setText(event.target.value)}
        spellCheck={false}
        aria-label="SVG 源码"
        className="ui-textarea min-h-[220px] text-xs"
      />
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <label htmlFor="svg-width" className="text-sm text-slate-600">输出宽度</label>
        <input id="svg-width" type="number" min={16} max={4096} value={width} onChange={(event) => setWidth(Math.max(16, Math.min(4096, Number(event.target.value))))} className="ui-input ui-input-sm w-28 font-mono" />
        <span className="text-xs text-slate-500">px，高度按原始宽高比自动计算</span>
        <div className="flex gap-1 ml-auto">
          {[128, 256, 512, 1024].map((value) => (
            <Button key={value} variant="secondary" size="sm" onClick={() => setWidth(value)}>{value}</Button>
          ))}
        </div>
      </div>
      <div className="mt-4"><Button icon={ScanLine} disabled={busy} onClick={generate}>{busy ? "转换中…" : "转换为 PNG"}</Button></div>
      {error && <Notice tone="error" className="mt-3">{error}</Notice>}
      <div className="mt-4"><ImageResult blob={blob} filename={`svg-${width}.png`} /></div>
    </Panel>
  );
}

/* ---------------- 页面外壳 ---------------- */

export default function ImageToolsPage() {
  const [mode, setMode] = useState<Mode>("watermark");
  const [source, setSource] = useState<ImageSource | null>(null);
  const [notice, setNotice] = useState("");
  const sourceRef = useRef<ImageSource | null>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  useEffect(() => { sourceRef.current = source; }, [source]);
  useEffect(() => () => {
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    try {
      const next = await loadImageFile(file);
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
      sourceRef.current = next;
      setSource(next);
      setNotice("");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "图片加载失败");
    }
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (mode === "svg") return;
      const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"));
      if (file) handleFile(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [handleFile, mode]);

  const clearSource = () => {
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
    sourceRef.current = null;
    setSource(null);
  };

  return (
    <ToolShell>
      <Segmented
        label="图片工具模式"
        value={mode}
        onChange={setMode}
        options={MODE_OPTIONS}
        className="mb-5"
      />

      {mode !== "svg" && (
        <Panel icon={ImagePlus} title="选择图片">
          {source ? (
            <SourcePreview
              source={source}
              onReplace={() => replaceRef.current?.click()}
              onClear={clearSource}
            />
          ) : <UploadArea onFile={handleFile} />}
          {notice && <Notice tone="error" className="mt-3">{notice}</Notice>}
          <input
            ref={replaceRef}
            type="file"
            accept="image/*,.svg"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleFile(file);
              event.target.value = "";
            }}
          />
        </Panel>
      )}

      {mode === "watermark" && <div className="mt-5"><WatermarkPanel source={source} /></div>}
      {mode === "round" && <div className="mt-5"><RoundPanel source={source} /></div>}
      {mode === "grid" && <div className="mt-5"><GridPanel source={source} /></div>}
      {mode === "ico" && <div className="mt-5"><IcoPanel source={source} /></div>}
      {mode === "svg" && <div className="mt-5"><SvgPanel /></div>}

      <Notice tone="tip" className="mt-5">
        所有处理都在浏览器本地的 canvas 上完成，图片不会上传。超大图会先校验文件大小（20 MB）与总像素（1600 万），避免卡死；切图与图标套件以 ZIP 打包，一次下载全部结果。
      </Notice>
    </ToolShell>
  );
}
