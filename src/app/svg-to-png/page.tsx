// app/svg-to-png/page.tsx
"use client";

import { useRef, useState } from "react";
import { FileImage, RefreshCw, ScanLine } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice } from "@/components/ui/ToolUI";
import { ImageResult } from "@/components/ui/ImageResult";
import { svgToPng } from "@/lib/image-canvas";

const SVG_SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <rect width="120" height="120" rx="24" fill="#4f46e5"/>
  <circle cx="60" cy="60" r="30" fill="#ffffff" opacity="0.92"/>
  <path d="M46 60 l10 10 l20 -22" fill="none" stroke="#4f46e5" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export default function SvgToPngPage() {
  const [text, setText] = useState(SVG_SAMPLE);
  const [width, setWidth] = useState(512);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      setBlob(await svgToPng(text, width));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "转换失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell>
      <div className="space-y-4">
        <div className="ui-options-bar">
          <label htmlFor="svg-width" className="flex items-center gap-2 text-xs text-slate-500">
            输出宽度
            <input
              id="svg-width"
              type="number"
              min={16}
              max={4096}
              value={width}
              onChange={(event) => setWidth(Math.max(16, Math.min(4096, Number(event.target.value))))}
              className="ui-input ui-input-sm w-24 font-mono text-center"
            />
            px
          </label>
          <div className="flex gap-1">
            {[128, 256, 512, 1024].map((value) => (
              <Button
                key={value}
                variant={width === value ? "primary" : "secondary"}
                size="sm"
                className="font-mono"
                aria-pressed={width === value}
                onClick={() => setWidth(value)}
              >
                {value}
              </Button>
            ))}
          </div>
          <span className="text-xs text-slate-500">高度按原始宽高比自动计算</span>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="secondary" size="sm" icon={FileImage} onClick={() => fileRef.current?.click()}>上传 .svg</Button>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => setText(SVG_SAMPLE)}>恢复示例</Button>
            <input
              ref={fileRef}
              type="file"
              accept=".svg,image/svg+xml"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) {
                  if (file.size > 2 * 1024 * 1024) setError("SVG 文件超过 2 MB，请精简后再上传");
                  else setText(await file.text());
                }
                event.target.value = "";
              }}
            />
          </div>
        </div>

        <textarea
          id="svg-source"
          value={text}
          onChange={(event) => setText(event.target.value)}
          spellCheck={false}
          aria-label="SVG 源码"
          className="ui-textarea ui-editor-sm text-xs font-mono"
        />
        <p className="ui-note">支持 viewBox / width / height；外链图片与字体可能受浏览器安全策略限制。</p>

        <div className="flex flex-wrap items-center gap-3">
          <Button icon={ScanLine} disabled={busy} onClick={generate}>
            {busy ? "转换中…" : "转换为 PNG"}
          </Button>
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <ImageResult blob={blob} filename={`svg-${width}.png`} checker />

        <p className="ui-note">
          在浏览器内用 SVG 图像解码后再画到 canvas，不依赖任何服务端；输出带 alpha 通道，透明背景会保留。
        </p>
      </div>
    </ToolShell>
  );
}
