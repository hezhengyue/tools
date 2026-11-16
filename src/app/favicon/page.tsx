// app/favicon/page.tsx
"use client";

import { useState } from "react";
import JSZip from "jszip";
import { FileArchive, FileImage, ImagePlus, Layers3 } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice } from "@/components/ui/ToolUI";
import { ImageUploadPanel } from "@/components/ui/ImageDrop";
import { FileResult } from "@/components/ui/ImageResult";
import { baseName, type ImageSource } from "@/lib/image-io";
import { buildIco, renderSquare } from "@/lib/image-canvas";
import { useImageSource } from "@/lib/use-image-source";

const ICO_SIZES = [16, 32, 48, 64, 128, 256];

function FaviconTool({ source }: { source: ImageSource | null }) {
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

  const stem = source ? baseName(source.name) : "favicon";

  return (
    <>
      <div className="ui-options-bar">
        <span className="text-xs text-slate-500 shrink-0">输出尺寸</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="输出尺寸">
          {ICO_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              aria-pressed={sizes.includes(size)}
              onClick={() => toggle(size)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors ${
                sizes.includes(size)
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
              }`}
            >
              {size}×{size}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 sm:ml-auto">源图先居中裁成正方形，再缩放为所选尺寸</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button icon={Layers3} disabled={!source || busy || sizes.length === 0} onClick={generate}>
          {busy ? "生成中…" : "生成 ICO 与 favicon 套件"}
        </Button>
        {!source && <span className="text-xs text-slate-500">先上传一张图片</span>}
        {source && sizes.length === 0 && <span className="text-xs text-slate-500">至少选一个尺寸</span>}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {ico && zip ? (
        <div className="space-y-3">
          <FileResult
            blob={ico}
            filename={`${stem}.ico`}
            label={`${stem}.ico`}
            note={`内含 ${sizes.length} 个尺寸`}
            icon={<FileImage size={18} strokeWidth={1.75} />}
          />
          <FileResult
            blob={zip}
            filename="favicon-png.zip"
            label="favicon-png.zip"
            note="各尺寸独立 PNG"
            icon={<FileArchive size={18} strokeWidth={1.75} />}
          />
        </div>
      ) : (
        <p className="ui-note">一个 ICO 里打包全部选中尺寸，另附一份同名 PNG 套件。</p>
      )}
    </>
  );
}

export default function FaviconPage() {
  const { source, notice, handleFile, clear } = useImageSource();

  return (
    <ToolShell>
      <div className="space-y-4">
        <ImageUploadPanel icon={ImagePlus} source={source} notice={notice} onFile={handleFile} onClear={clear} />
        <FaviconTool source={source} />
        <p className="ui-note">
          一个 ICO 里打包全部尺寸，浏览器按场景自取；把 favicon.ico 放到站点根目录即可被自动识别。
        </p>
      </div>
    </ToolShell>
  );
}
