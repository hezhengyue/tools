// src/components/ui/ImageDrop.tsx
// 图片类工具共用的上传区与「当前图片」卡片：拖入 / 点击 / 粘贴三种入口。
// 视觉与 /image-compress 一致：虚线大上传区 + 白底圆形图标，选中后换成信息卡片。

"use client";

import { useRef, useState, type ElementType } from "react";
import { ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { Notice } from "@/components/ui/ToolUI";
import { formatBytes, MAX_FILE_SIZE, type ImageSource } from "@/lib/image-io";

export function ImageDropZone({
  onFile, icon: Icon = ImagePlus, hint,
}: {
  onFile: (file: File) => void;
  icon?: ElementType;
  hint?: string;
}) {
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
      className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
        dragging ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 bg-slate-50/50 hover:border-slate-400"
      }`}
    >
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
      <div className="flex flex-col items-center gap-3">
        <div className="p-4 bg-white rounded-full shadow-sm">
          <Icon size={32} strokeWidth={1.6} className="text-indigo-600" />
        </div>
        <div>
          <p className="font-medium text-slate-700">拖拽图片到此处，或点击上传</p>
          <p className="text-sm text-slate-500 mt-1">
            {hint ?? `PNG / JPG / WebP / GIF / SVG · 最大 ${formatBytes(MAX_FILE_SIZE)} · 也可直接 Ctrl/⌘+V 粘贴`}
          </p>
        </div>
      </div>
    </div>
  );
}

/** 已选中的图片：缩略图 + 尺寸体积 + 更换 / 移除，样式对齐处理结果卡片 */
export function ImageSourceCard({
  source, onReplace, onClear,
}: { source: ImageSource; onReplace: () => void; onClear: () => void }) {
  const width = source.img.naturalWidth || 0;
  const height = source.img.naturalHeight || 0;

  return (
    <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white rounded-2xl border border-slate-200">
      <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
        <img src={source.url} alt="原图预览" className="w-full h-full object-contain" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-700 truncate" title={source.name}>{source.name}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {width || "—"} × {height || "—"} px · {formatBytes(source.size)}
        </p>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={onReplace}
          aria-label="更换图片"
          title="更换图片"
          className="ui-btn ui-btn-secondary ui-btn-sm"
        >
          <RefreshCw size={14} strokeWidth={1.75} />
          <span className="hidden sm:inline">更换</span>
        </button>
        <button type="button" onClick={onClear} className="ui-icon-btn text-red-600 hover:bg-red-50" title="移除" aria-label="移除这张图片">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * 完整的上传区：未选图时是虚线拖拽区，选图后换成信息卡片。
 * 内部自带隐藏 file input 与错误提示；页面不要再写一遍上传逻辑。
 */
export function ImageUploadPanel({
  source, notice, onFile, onClear, icon = ImagePlus, hint,
}: {
  source: ImageSource | null;
  notice?: string;
  onFile: (file: File) => void;
  onClear: () => void;
  icon?: ElementType;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      {source ? (
        <ImageSourceCard source={source} onReplace={() => inputRef.current?.click()} onClear={onClear} />
      ) : (
        <ImageDropZone onFile={onFile} icon={icon} hint={hint} />
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
    </div>
  );
}
