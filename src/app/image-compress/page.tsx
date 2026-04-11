// app/image-compress/page.tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { 
  Upload, Download, Trash2, Settings, Image as ImageIcon, 
  FileImage, ShieldCheck, Zap, Info, Lock
} from "lucide-react";
import ToolShell from "@/components/ToolShell";

// 支持的输出格式
type OutputFormat = "webp" | "avif" | "jpeg";
// 压缩质量预设
type QualityPreset = "high" | "medium" | "small";

interface ProcessedFile {
  original: File;
  processed: Blob;
  preview: string;
  originalSize: number;
  processedSize: number;
  format: string;
  width: number;
  height: number;
  changes: string[];
}

// 质量预设对应的参数
const QUALITY_CONFIG: Record<QualityPreset, { quality: number; maxSize?: number }> = {
  high: { quality: 0.92 },
  medium: { quality: 0.75 },
  small: { quality: 0.55, maxSize: 1920 },
};

export default function ImageCompressPage() {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [format, setFormat] = useState<OutputFormat>("webp");
  const [quality, setQuality] = useState<QualityPreset>("medium");
  
  // 🔧 隐私保护：默认开启且不可关闭
  const [enableCompress, setEnableCompress] = useState(true);
  const enableRemoveExif = true; // ✅ 强制开启，保护用户隐私
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🔧 核心：图片处理函数
  const processImage = useCallback(async (file: File): Promise<ProcessedFile | null> => {
    if (!file.type.startsWith("image/")) return null;

    const changes: string[] = ["🔒 已清除隐私"];
    
    // 🎯 情况：不压缩 → 仅清除EXIF（Canvas重绘）
    if (!enableCompress) {
      const img = await createImageBitmap(file);
      const { width, height } = img;
      
      // Canvas重绘自动剥离EXIF
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      // 保持原格式导出
      const mimeType = file.type || "image/jpeg";
      const blob = await canvas.convertToBlob({ type: mimeType });
      
      return {
        original: file,
        processed: blob,
        preview: URL.createObjectURL(blob),
        originalSize: file.size,
        processedSize: blob.size,
        format: mimeType,
        width,
        height,
        changes,
      };
    }

    // 🎯 情况：压缩 + 清除EXIF
    const img = await createImageBitmap(file);
    let { width, height } = img;

    // 应用尺寸限制
    const { maxSize } = QUALITY_CONFIG[quality];
    if (maxSize && Math.max(width, height) > maxSize) {
      const ratio = maxSize / Math.max(width, height);
      width = Math.floor(width * ratio);
      height = Math.floor(height * ratio);
    }

    // Canvas重绘 + 压缩
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const mimeType = `image/${format}`;
    const blob = await canvas.convertToBlob({ 
      type: mimeType, 
      quality: QUALITY_CONFIG[quality].quality 
    });

    changes.push(`🗜️ 压缩(${QUALITY_CONFIG[quality].quality * 100}%)`);

    return {
      original: file,
      processed: blob,
      preview: URL.createObjectURL(blob),
      originalSize: file.size,
      processedSize: blob.size,
      format: mimeType,
      width,
      height,
      changes,
    };
  }, [enableCompress, format, quality]);

  // 📥 文件选择
  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    
    setIsProcessing(true);
    const newFiles: ProcessedFile[] = [];

    for (const file of Array.from(fileList)) {
      if (file.type.startsWith("image/")) {
        const result = await processImage(file);
        if (result) newFiles.push(result);
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
    setIsProcessing(false);
  }, [processImage]);

  // 🖱️ 拖拽
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  // 🗑️ 移除
  const removeFile = useCallback((index: number) => {
    setFiles(prev => {
      const file = prev[index];
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // 💾 下载
  const downloadFile = useCallback((file: ProcessedFile) => {
    const ext = file.format.replace("image/", "");
    const name = file.original.name.replace(/\.\w+$/, `.${ext}`);
    
    const link = document.createElement("a");
    link.download = name;
    link.href = file.preview;
    link.click();
  }, []);

  // 🧹 清空
  const clearAll = useCallback(() => {
    files.forEach(f => URL.revokeObjectURL(f.preview));
    setFiles([]);
  }, [files]);

  // 📐 格式化
  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // 📊 压缩率
  const calcRatio = (original: number, processed: number) => {
    return Math.round((1 - processed / original) * 100);
  };

  // 🧩 选项卡片组件
  const OptionCard = ({ 
    checked, 
    onChange, 
    disabled,
    title, 
    desc, 
    icon: Icon,
    badge 
  }: { 
    checked: boolean; 
    onChange?: (v: boolean) => void; 
    disabled?: boolean;
    title: string; 
    desc: string; 
    icon: React.ElementType;
    badge?: string;
  }) => (
    <div 
      className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
        disabled 
          ? "bg-slate-50 border-slate-200 cursor-not-allowed" 
          : checked 
            ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200" 
            : "bg-white border-slate-200 hover:border-slate-300 cursor-pointer"
      }`}
      onClick={() => !disabled && onChange?.(!checked)}
    >
      <div className="relative mt-0.5">
        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
          disabled 
            ? "bg-slate-100 border-slate-200" 
            : checked 
              ? "bg-indigo-600 border-indigo-600" 
              : "border-slate-300 bg-white"
        }`}>
          {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          {disabled && <Lock size={12} className="text-slate-400" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon size={16} className={disabled ? "text-slate-300" : checked ? "text-indigo-600" : "text-slate-400"} />
          <span className={`font-medium ${disabled ? "text-slate-400" : checked ? "text-slate-800" : "text-slate-600"}`}>
            {title}
          </span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );

  // 🧩 工具栏
  const renderToolbar = () => (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-white/90 backdrop-blur-sm border-b border-slate-200 rounded-xl border">
      {/* 格式选择 */}
      <div className="flex items-center gap-2">
        <FileImage size={16} className="text-slate-500" />
        <span className="text-xs text-slate-500 hidden sm:inline">格式</span>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as OutputFormat)}
          disabled={!enableCompress}
          className={`text-sm border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            !enableCompress ? "border-slate-100 text-slate-400 cursor-not-allowed" : "border-slate-200"
          }`}
        >
          <option value="webp">WebP 🎯</option>
          <option value="avif">AVIF ✨</option>
          <option value="jpeg">JPEG 🔒</option>
        </select>
      </div>

      {/* 质量预设 */}
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-slate-500" />
        <span className="text-xs text-slate-500 hidden sm:inline">压缩</span>
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value as QualityPreset)}
          disabled={!enableCompress}
          className={`text-sm border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            !enableCompress ? "border-slate-100 text-slate-400 cursor-not-allowed" : "border-slate-200"
          }`}
        >
          <option value="high">高清 (92%)</option>
          <option value="medium">平衡 (75%)</option>
          <option value="small">极小 (55%)</option>
        </select>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 ml-auto">
        {files.length > 0 && (
          <button
            onClick={clearAll}
            className="p-2 rounded-lg bg-white border border-slate-200 text-red-500 hover:bg-red-50"
            title="清空"
          >
            <Trash2 size={18} />
          </button>
        )}
        <label className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-sm">
          <Upload size={18} />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>
    </div>
  );

  return (
    <ToolShell>
      <div className="space-y-4">
        {/* 上传区域 */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
            dragActive 
              ? "border-indigo-500 bg-indigo-50/50" 
              : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 bg-white rounded-full shadow-sm">
              <ImageIcon size={32} className="text-indigo-600" />
            </div>
            <div>
              <p className="font-medium text-slate-700">
                {isProcessing ? "处理中..." : "拖拽图片到此处，或点击上传"}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                支持 JPG / PNG / HEIC / WebP 等格式，批量处理
              </p>
            </div>
          </div>
        </div>

        {/* 🔧 功能选项 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 压缩选项 - 可选 */}
          <OptionCard
            checked={enableCompress}
            onChange={setEnableCompress}
            title="🗜️ 压缩图片"
            desc="转 WebP/AVIF 格式，体积减少 40%~70%"
            icon={Zap}
          />
          {/* 隐私选项 - 必选 */}
          <OptionCard
            checked={true}
            disabled={true}
            title="🔒 清除隐私"
            desc="自动移除 GPS、时间、设备型号等 EXIF 信息"
            icon={ShieldCheck}
            badge="必选"
          />
        </div>

        {/* 处理结果 */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-slate-700">
                已处理 {files.length} 张图片
              </h3>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                总计节省 {formatSize(files.reduce((sum, f) => sum + f.originalSize - f.processedSize, 0))}
              </span>
            </div>

            {files.map((file, index) => (
              <div 
                key={index}
                className="flex gap-4 p-4 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-colors"
              >
                {/* 预览 */}
                <div className="w-24 h-24 flex-shrink-0 bg-slate-100 rounded-xl overflow-hidden">
                  <img 
                    src={file.preview} 
                    alt="preview"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700 truncate" title={file.original.name}>
                        {file.original.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {file.width > 0 ? `${file.width}×${file.height} • ` : ""}
                        {file.format.toUpperCase()}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="移除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* 操作标签 */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {file.changes.map((c, i) => (
                      <span 
                        key={i}
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          c.includes("隐私") 
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200" 
                            : "bg-indigo-50 text-indigo-600"
                        }`}
                      >
                        {c}
                      </span>
                    ))}
                  </div>

                  {/* 大小对比 */}
                  {enableCompress && (
                    <div className="mt-2 flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">原:</span>
                        <span className="font-medium text-slate-600">{formatSize(file.originalSize)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">后:</span>
                        <span className="font-medium text-emerald-600">{formatSize(file.processedSize)}</span>
                      </div>
                      {file.processedSize < file.originalSize && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">
                          <Zap size={12} />
                          <span className="font-medium">-{calcRatio(file.originalSize, file.processedSize)}%</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 下载 */}
                <button
                  onClick={() => downloadFile(file)}
                  className="flex-shrink-0 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                  title="下载"
                >
                  <Download size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 隐私保护说明 */}
        <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/60 text-sm text-emerald-800">
          <div className="flex items-start gap-2">
            <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-emerald-600" />
            <div className="space-y-1">
              <p><strong>🔐 隐私保护已启用</strong>：所有处理的图片都会自动清除以下敏感信息：</p>
              <ul className="ml-4 list-disc text-emerald-700/90">
                <li>📍 GPS 地理位置坐标（防止泄露家庭/公司地址）</li>
                <li>📱 设备型号、镜头参数（防止设备指纹追踪）</li>
                <li>🕐 精确拍摄时间（防止时间线分析）</li>
                <li>👤 作者、版权信息（防止个人信息泄露）</li>
              </ul>
              <p className="text-xs text-emerald-600/80 mt-2">
                💡 这是为了保护您的隐私安全，该选项无法关闭。
              </p>
            </div>
          </div>
        </div>

        {/* 底部说明 */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-sm text-slate-600">
          <div className="flex items-start gap-2">
            <Settings size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p><strong>⚡ 纯前端处理</strong>：所有计算在浏览器完成，图片<em>不会上传到服务器</em></p>
              <p><strong>💡 使用建议</strong>：上传社交媒体前开启压缩；仅清除隐私时关闭压缩保留原画质</p>
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  );
}