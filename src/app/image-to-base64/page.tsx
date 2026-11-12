"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  Trash2, Image as ImageIcon, FileImage, FileCode
} from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { CopyButton, Notice } from "@/components/ui/ToolUI";

// 20MB 的文件会生成约 27MB 的 Base64 文本，再大就容易导致标签页卡死
const MAX_FILE_BYTES = 20 * 1024 * 1024;

interface LoadedImage {
  name: string;
  type: string;
  size: number;
  /** 只保存一份纯 Base64 字符串；前缀与展示值都派生自它 */
  raw: string;
}

export default function ImageToBase64Page() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [includePrefix, setIncludePrefix] = useState(true);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);

  // 卸载时中止读取，避免离开页面后仍 setState
  useEffect(() => () => { readerRef.current?.abort(); }, []);

  const dataUri = useMemo(
    () => (image ? `data:${image.type || "image/png"};base64,${image.raw}` : ""),
    [image]
  );
  const output = includePrefix ? dataUri : image?.raw || "";

  const processFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      setError("请选择有效的图片文件");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError("图片超过 20MB，转换后的文本过大会导致页面卡顿");
      return;
    }
    setError("");
    readerRef.current?.abort();
    const reader = new FileReader();
    readerRef.current = reader;
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== "string") {
        setError("读取图片失败，请重试");
        return;
      }
      setImage({
        name: f.name,
        type: f.type,
        size: f.size,
        raw: result.split(",")[1] || "",
      });
    };
    reader.onerror = () => setError("读取图片失败，可能文件已损坏");
    reader.readAsDataURL(f);
  }, []);

  const handleReset = () => {
    readerRef.current?.abort();
    readerRef.current = null;
    setImage(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatFileSize = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <ToolShell>
      <div className="space-y-5">
        {error && <Notice tone="error">{error}</Notice>}

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
              if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
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
            aria-label="上传需要转换的图片"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="选择图片"
              onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
            />
            <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mb-4">
              <ImageIcon size={32} className="text-indigo-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">上传需要转换的图片</h3>
            <p className="text-slate-500 text-sm">拖拽到此处，或点击选择（支持 JPG、PNG、GIF、WebP，最大 20MB）</p>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Top toolbar */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3 px-2 flex-1 min-w-0">
                <FileImage size={20} className="text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{image.name}</p>
                  <p className="text-xs text-slate-500">{image.type || "image/*"} • {formatFileSize(image.size)}</p>
                </div>
              </div>
              <button onClick={handleReset} className="ui-icon-btn text-red-600 hover:bg-red-50" title="重置" aria-label="重置">
                <Trash2 size={18} />
              </button>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Preview：直接复用 dataUri，不再额外创建一份 ObjectURL */}
              <div className="lg:col-span-2 bg-slate-100/80 border border-slate-200 rounded-2xl flex items-center justify-center p-4 min-h-[300px]">
                <img src={dataUri} alt={`${image.name} 的预览`} className="max-w-full max-h-[60vh] object-contain drop-shadow-lg rounded-lg" />
              </div>

              {/* Base64 Output */}
              <div className="lg:col-span-3 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <FileCode size={16} className="text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">Base64 编码结果</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-xs text-slate-500">包含前缀 (Data URI)</span>
                      <input
                        type="checkbox"
                        checked={includePrefix}
                        onChange={(e) => setIncludePrefix(e.target.checked)}
                        className="ui-checkbox"
                      />
                    </label>
                    <CopyButton value={output} label="复制 Base64" />
                  </div>
                </div>
                <textarea
                  readOnly
                  value={output}
                  aria-label="Base64 编码结果"
                  className="ui-textarea flex-1 text-xs min-h-[300px] resize-none"
                />
                <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <span className="text-xs text-slate-500 hidden sm:block">
                    字符数: {output.length.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
