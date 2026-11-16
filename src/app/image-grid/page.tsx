// app/image-grid/page.tsx
"use client";

import { useState } from "react";
import JSZip from "jszip";
import { FileArchive, Grid3x3, ImagePlus } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice, Segmented } from "@/components/ui/ToolUI";
import { ImageUploadPanel } from "@/components/ui/ImageDrop";
import { FileResult } from "@/components/ui/ImageResult";
import { baseName, canvasToBlob, type ImageSource } from "@/lib/image-io";
import { sliceGrid } from "@/lib/image-canvas";
import { useImageSource } from "@/lib/use-image-source";

function GridTool({ source }: { source: ImageSource | null }) {
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
    <>
      <div className="ui-options-bar">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">行数</span>
          <Segmented
            label="切图行数"
            value={String(rows)}
            options={[2, 3, 4].map((n) => ({ value: String(n), label: `${n} 行` }))}
            onChange={(next) => setRows(Number(next))}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">列数</span>
          <Segmented
            label="切图列数"
            value={String(cols)}
            options={[2, 3, 4].map((n) => ({ value: String(n), label: `${n} 列` }))}
            onChange={(next) => setCols(Number(next))}
          />
        </div>
        <span className="text-xs text-slate-500 sm:ml-auto">共 {rows * cols} 张，每张约 {Math.floor((source?.img.naturalWidth || 0) / cols)}×{Math.floor((source?.img.naturalHeight || 0) / rows)} px</span>
      </div>

      {source && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex justify-center">
          <div className="relative inline-block max-w-full">
            <img src={source.url} alt="切图预览" className="block max-w-full max-h-[62vh] object-contain rounded-lg" />
            <div
              className="absolute inset-0 grid pointer-events-none"
              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
            >
              {Array.from({ length: rows * cols }, (_, index) => (
                <div key={index} className="border border-dashed border-white/80 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]" />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button icon={Grid3x3} disabled={!source || busy} onClick={generate}>
          {busy ? "生成中…" : `生成 ${rows * cols} 张并打包`}
        </Button>
        {!source && <span className="text-xs text-slate-500">先上传一张图片</span>}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {blob ? (
        <FileResult
          blob={blob}
          filename={`${source ? baseName(source.name) : "image"}-grid.zip`}
          label={`${source ? baseName(source.name) : "image"}-grid.zip`}
          note={`${count} 张 PNG 已打包`}
          icon={<FileArchive size={18} strokeWidth={1.75} />}
        />
      ) : (
        <p className="ui-note">点上方按钮切图并打包，结果以 ZIP 一次下载。</p>
      )}
    </>
  );
}

export default function ImageGridPage() {
  const { source, notice, handleFile, clear } = useImageSource();

  return (
    <ToolShell>
      <div className="space-y-4">
        <ImageUploadPanel icon={ImagePlus} source={source} notice={notice} onFile={handleFile} onClear={clear} />
        <GridTool source={source} />
        <p className="ui-note">
          按行列等分后逐块导出，除不尽的余数并入最后一行/列，保证拼接回来与原图完全一致；结果以 ZIP 一次下载。
        </p>
      </div>
    </ToolShell>
  );
}
