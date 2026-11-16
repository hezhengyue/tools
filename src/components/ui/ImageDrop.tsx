// src/components/ui/ImageDrop.tsx
// 图片类工具共用的上传区与「当前图片」条：拖入 / 点击 / 粘贴三种入口，
// 尺寸与体积说明由 @/lib/image-io 的上限常量派生，避免各页文案写错。

"use client";

import { useRef, useState, type ElementType } from "react";
import { RefreshCw, Upload } from "lucide-react";
import { Button, Notice, Panel } from "@/components/ui/ToolUI";
import { formatBytes, MAX_FILE_SIZE, type ImageSource } from "@/lib/image-io";

export function ImageDropZone({ onFile, hint }: { onFile: (file: File) => void; hint?: string }) {
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
      <p className="text-xs text-slate-500">
        {hint ?? `PNG / JPG / WebP / GIF / SVG · 最大 ${formatBytes(MAX_FILE_SIZE)} · 1600 万像素以内`}
      </p>
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

/**
 * 完整的「选择图片」面板：上传区 / 当前图片条 + 隐藏的文件输入 + 错误提示。
 * 每个图片工具页只需要把 useImageSource() 的返回值接进来。
 */
export function ImageUploadPanel({
  source, notice, onFile, onClear, title = "选择图片", icon = Upload,
}: {
  source: ImageSource | null;
  notice?: string;
  onFile: (file: File) => void;
  onClear: () => void;
  title?: string;
  icon?: ElementType;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Panel icon={icon} title={title}>
      {source ? (
        <ImageSourceBar source={source} onReplace={() => inputRef.current?.click()} onClear={onClear} />
      ) : (
        <ImageDropZone onFile={onFile} />
      )}
      {notice && <Notice tone="error" className="mt-3">{notice}</Notice>}
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
    </Panel>
  );
}

export function ImageSourceBar({
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
