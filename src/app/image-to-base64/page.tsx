"use client";

import { useState, useRef, useCallback } from "react";
import { 
  Trash2, Copy, Check, Image as ImageIcon, Info, FileImage, FileCode
} from "lucide-react";
import ToolShell from "@/components/ToolShell";

export default function ImageToBase64Page() {
  const [file, setFile] = useState<File | null>(null);
  const [base64, setBase64] = useState(""); // 带 Data URI 前缀
  const [rawBase64, setRawBase64] = useState(""); // 纯 Base64 数据
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [includePrefix, setIncludePrefix] = useState(true);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      alert("请上传有效的图片文件");
      return;
    }

    setFile(f);
    
    // 生成预览 URL
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);

    // 读取为 Base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setBase64(result); 
      
      // 提取纯 Base64 数据 (去除 data:image/png;base64, 部分)
      const base64Data = result.split(",")[1] || "";
      setRawBase64(base64Data);
    };
    reader.readAsDataURL(f);
  }, []);

  const handleCopy = async () => {
    const textToCopy = includePrefix ? base64 : rawBase64;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (err) {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  };

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl); // 释放内存
    setFile(null);
    setBase64("");
    setRawBase64("");
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <ToolShell>
      <div className="space-y-5">
        {!file ? (
          <div
            className={`border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer min-h-[400px] ${
              dragActive ? "border-indigo-500 bg-indigo-50/50 scale-[1.01]" : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
            <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mb-4">
              <ImageIcon size={32} className="text-indigo-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">上传需要转换的图片</h3>
            <p className="text-slate-500 text-sm">拖拽到此处，或点击选择 (支持 JPG, PNG, GIF, WebP 等)</p>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Top toolbar */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3 px-2 flex-1 min-w-0">
                <FileImage size={20} className="text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{file.type || "image/*"} • {formatFileSize(file.size)}</p>
                </div>
              </div>
              <button onClick={handleReset} className="p-2 text-red-500 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors" title="重置">
                <Trash2 size={18} />
              </button>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Preview */}
              <div className="lg:col-span-2 bg-slate-100/80 border border-slate-200 rounded-2xl flex items-center justify-center p-4 min-h-[300px]">
                <img src={previewUrl} alt="Preview" className="max-w-full max-h-[60vh] object-contain drop-shadow-lg rounded-lg" />
              </div>

              {/* Base64 Output */}
              <div className="lg:col-span-3 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <FileCode size={16} className="text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">Base64 编码结果</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs text-slate-500">包含前缀 (Data URI)</span>
                    <input 
                      type="checkbox" 
                      checked={includePrefix} 
                      onChange={(e) => setIncludePrefix(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 rounded"
                    />
                  </label>
                </div>
                <textarea
                  readOnly
                  value={includePrefix ? base64 : rawBase64}
                  className="flex-1 w-full p-4 text-xs font-mono text-slate-600 bg-white outline-none resize-none min-h-[300px] break-all"
                />
                <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <span className="text-xs text-slate-400 hidden sm:block">
                    字符数: {(includePrefix ? base64 : rawBase64).length.toLocaleString()}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium flex items-center gap-2 text-sm shadow-sm transition-all"
                  >
                    {copyStatus === "copied" ? (
                      <><Check size={16} /> 已复制</>
                    ) : copyStatus === "error" ? (
                      "复制失败"
                    ) : (
                      <><Copy size={16} /> 复制代码</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}