// app/image-grid/page.tsx
"use client";

import { useState } from "react";
import JSZip from "jszip";
import { Download, Grid3x3, ImagePlus } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice, Panel, Segmented } from "@/components/ui/ToolUI";
import { ImageUploadPanel } from "@/components/ui/ImageDrop";
import { baseName, canvasToBlob, downloadBlob, formatBytes, type ImageSource } from "@/lib/image-io";
import { sliceGrid } from "@/lib/image-canvas";
import { useImageSource } from "@/lib/use-image-source";

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
          <img src={source.url} alt="切图预览" className="w-full max-h-[70vh] object-contain" />
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
      {!source && <p className="ui-note mt-3">请先在上方上传一张图片。</p>}
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

export default function ImageGridPage() {
  const { source, notice, handleFile, clear } = useImageSource();

  return (
    <ToolShell>
      <ImageUploadPanel icon={ImagePlus} source={source} notice={notice} onFile={handleFile} onClear={clear} />
      <div className="mt-5"><GridPanel source={source} /></div>
      <p className="ui-note mt-5">
        按行列等分后逐块导出，除不尽的余数并入最后一行/列，保证拼接回来与原图完全一致；结果以 ZIP 一次下载。
      </p>
    </ToolShell>
  );
}
