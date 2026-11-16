// src/components/ui/ImageResult.tsx
// 图片工具的结果区：卡片式（标题行 + 预览 + 下载），与 /image-compress 的处理结果卡同一套视觉。
// 非图片产物（ZIP、ICO）用 FileResult，避免把图标当预览图塞进去。

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/ToolUI";
import { downloadBlob, formatBytes } from "@/lib/image-io";

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
  "image/avif": "AVIF",
  "image/gif": "GIF",
  "image/svg+xml": "SVG",
  "application/zip": "ZIP",
  "image/x-icon": "ICO",
};

/** 结果卡片外壳：标题行（名称 + 说明 + 下载） + 内容区 */
export function ResultCard({
  title, meta, action, children,
}: { title: string; meta: string; action: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-slate-200">
        <span className="text-sm font-medium text-slate-700 truncate max-w-full" title={title}>{title}</span>
        <span className="text-xs text-slate-500">{meta}</span>
        <div className="ml-auto shrink-0">{action}</div>
      </div>
      {children}
    </div>
  );
}

export function ImageResult({
  blob, filename, hint, checker = false,
}: { blob: Blob | null; filename: string; hint?: string; checker?: boolean }) {
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

  if (!blob) return <p className="ui-note">{hint ?? "设置参数后点「生成预览」查看结果"}</p>;

  return (
    <ResultCard
      title={filename}
      meta={`${EXT_BY_TYPE[blob.type] ?? "文件"} · ${formatBytes(blob.size)}`}
      action={<Button size="sm" icon={Download} onClick={() => downloadBlob(blob, filename)}>下载</Button>}
    >
      <div className={`p-4 flex items-center justify-center overflow-auto max-h-[70vh] ${checker ? "ui-checker" : "bg-slate-50"}`}>
        {url && <img src={url} alt="处理结果预览" className="max-w-full max-h-[62vh] object-contain rounded-lg shadow-sm" />}
      </div>
    </ResultCard>
  );
}

/** 非图片产物（ZIP / ICO）的结果行：图标 + 名称体积 + 下载按钮 */
export function FileResult({
  blob, filename, label, icon, note,
}: { blob: Blob; filename: string; label: string; icon: ReactNode; note?: string }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200">
      <div className="w-10 h-10 shrink-0 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-700 truncate" title={filename}>{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{note ? `${note} · ` : ""}{formatBytes(blob.size)}</p>
      </div>
      <Button size="sm" icon={Download} onClick={() => downloadBlob(blob, filename)} className="shrink-0">下载</Button>
    </div>
  );
}
