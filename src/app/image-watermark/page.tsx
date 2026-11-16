// app/image-watermark/page.tsx
"use client";

import { useState } from "react";
import { ImagePlus, Stamp } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice, Switch } from "@/components/ui/ToolUI";
import { ImageUploadPanel } from "@/components/ui/ImageDrop";
import { ImageResult } from "@/components/ui/ImageResult";
import { baseName, canvasToBlob, type ImageSource } from "@/lib/image-io";
import { drawWatermark, type WatermarkPosition } from "@/lib/image-canvas";
import { useImageSource } from "@/lib/use-image-source";

const POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: "tl", label: "左上" }, { value: "tc", label: "上中" }, { value: "tr", label: "右上" },
  { value: "ml", label: "左中" }, { value: "mc", label: "正中" }, { value: "mr", label: "右中" },
  { value: "bl", label: "左下" }, { value: "bc", label: "下中" }, { value: "br", label: "右下" },
];

function WatermarkTool({ source }: { source: ImageSource | null }) {
  const [text, setText] = useState("正月工具箱 · 仅供演示");
  const [color, setColor] = useState("#ffffff");
  const [opacity, setOpacity] = useState(60);
  const [scale, setScale] = useState(4);
  const [position, setPosition] = useState<WatermarkPosition>("br");
  const [tiled, setTiled] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      const canvas = drawWatermark(source.img, {
        text: text || " ", color, opacity: opacity / 100, scale, position, tiled, rotation,
      });
      setBlob(await canvasToBlob(canvas));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="ui-options-bar">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <label htmlFor="wm-text" className="text-xs text-slate-500 shrink-0">水印文字</label>
          <input
            id="wm-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="ui-input ui-input-sm flex-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="wm-color" className="text-xs text-slate-500">文字颜色</label>
          <input
            id="wm-color"
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="w-9 h-9 p-1 bg-white border border-slate-200 rounded-lg cursor-pointer"
          />
          <span className="font-mono text-xs text-slate-500">{color.toUpperCase()}</span>
        </div>
        <label htmlFor="wm-rotation" className="flex items-center gap-2 text-xs text-slate-500">
          旋转
          <input
            id="wm-rotation"
            type="number"
            min={-90}
            max={90}
            value={rotation}
            onChange={(event) => setRotation(Math.max(-90, Math.min(90, Number(event.target.value))))}
            className="ui-input ui-input-sm w-16 font-mono text-center"
          />
          度
        </label>
        <Switch id="wm-tiled" checked={tiled} onChange={setTiled} label="平铺整个画面" />
      </div>

      <div className="ui-form-grid">
        <div>
          <label htmlFor="wm-opacity" className="ui-label text-sm block mb-2">不透明度 {opacity}%</label>
          <input
            id="wm-opacity"
            type="range"
            min={5}
            max={100}
            value={opacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
            className="w-full accent-indigo-600"
          />
        </div>
        <div>
          <label htmlFor="wm-scale" className="ui-label text-sm block mb-2">字号（占图宽 {scale}%）</label>
          <input
            id="wm-scale"
            type="range"
            min={1}
            max={15}
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
            className="w-full accent-indigo-600"
          />
        </div>
        <div>
          <span className="ui-label text-sm block mb-2">水印位置</span>
          <div className="grid grid-cols-3 gap-1 max-w-[208px]" role="group" aria-label="水印位置">
            {POSITIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                disabled={tiled}
                aria-pressed={position === item.value}
                onClick={() => setPosition(item.value)}
                className={`py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-40 ${
                  position === item.value
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button icon={Stamp} disabled={!source || busy} onClick={generate}>
          {busy ? "生成中…" : "生成预览"}
        </Button>
        {!source && <span className="text-xs text-slate-500">先上传一张图片</span>}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <ImageResult
        blob={blob}
        filename={source ? `${baseName(source.name)}-watermark.png` : "watermark.png"}
      />
    </>
  );
}

export default function ImageWatermarkPage() {
  const { source, notice, handleFile, clear } = useImageSource();

  return (
    <ToolShell>
      <div className="space-y-4">
        <ImageUploadPanel icon={ImagePlus} source={source} notice={notice} onFile={handleFile} onClear={clear} />
        <WatermarkTool source={source} />
        <p className="ui-note">
          水印直接烧进像素，导出即可分享；字号按图片宽度百分比计算，换分辨率也不会变形。
        </p>
      </div>
    </ToolShell>
  );
}
