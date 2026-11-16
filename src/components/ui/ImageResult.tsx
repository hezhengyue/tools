// src/components/ui/ImageResult.tsx
// 图片工具的统一结果区：预览 + 体积 + 下载。图片导出属于整页动作，用 Button 而不是图标按钮。

"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button, EmptyState } from "@/components/ui/ToolUI";
import { downloadBlob, formatBytes } from "@/lib/image-io";

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

  if (!blob) return <EmptyState>{hint ?? "设置参数后点「生成预览」查看结果"}</EmptyState>;

  return (
    <div>
      <div className={`ui-display p-4 flex items-center justify-center ui-editor ${checker ? "ui-checker" : ""}`}>
        {url && <img src={url} alt="处理结果预览" className="max-w-full max-h-[70vh] object-contain rounded-lg" />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <span className="text-xs text-slate-500">输出 {formatBytes(blob.size)}</span>
        <Button icon={Download} onClick={() => downloadBlob(blob, filename)}>下载 {filename}</Button>
      </div>
    </div>
  );
}
