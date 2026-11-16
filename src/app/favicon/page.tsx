// app/favicon/page.tsx
"use client";

import { useState } from "react";
import JSZip from "jszip";
import { Download, ImagePlus, Layers3 } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice, Panel } from "@/components/ui/ToolUI";
import { ImageUploadPanel } from "@/components/ui/ImageDrop";
import { baseName, downloadBlob, formatBytes, type ImageSource } from "@/lib/image-io";
import { buildIco, renderSquare } from "@/lib/image-canvas";
import { useImageSource } from "@/lib/use-image-source";

const ICO_SIZES = [16, 32, 48, 64, 128, 256];

function FaviconPanel({ source }: { source: ImageSource | null }) {
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
      {!source && <p className="ui-note mt-3">请先在上方上传一张图片。</p>}
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

export default function FaviconPage() {
  const { source, notice, handleFile, clear } = useImageSource();

  return (
    <ToolShell>
      <ImageUploadPanel icon={ImagePlus} source={source} notice={notice} onFile={handleFile} onClear={clear} />
      <div className="mt-5"><FaviconPanel source={source} /></div>
      <p className="ui-note mt-5">
        一个 ICO 里打包全部尺寸，浏览器按场景自取；把 favicon.ico 放到站点根目录即可被自动识别。
      </p>
    </ToolShell>
  );
}
