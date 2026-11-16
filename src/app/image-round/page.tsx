// app/image-round/page.tsx
"use client";

import { useState } from "react";
import { Crop, ImagePlus } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice, Panel, Switch } from "@/components/ui/ToolUI";
import { ImageUploadPanel } from "@/components/ui/ImageDrop";
import { ImageResult } from "@/components/ui/ImageResult";
import { baseName, canvasToBlob, type ImageSource } from "@/lib/image-io";
import { drawRounded } from "@/lib/image-canvas";
import { useImageSource } from "@/lib/use-image-source";

function RoundPanel({ source }: { source: ImageSource | null }) {
  const [radius, setRadius] = useState(16);
  const [white, setWhite] = useState(false);
  const [square, setSquare] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      setBlob(await canvasToBlob(drawRounded(source.img, radius, white, square)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel icon={Crop} title="圆角参数">
      <label htmlFor="round-radius" className="ui-label text-sm block mb-2">圆角半径 {radius}%（按短边计算）</label>
      <input id="round-radius" type="range" min={0} max={50} value={radius} onChange={(event) => setRadius(Number(event.target.value))} className="w-full accent-indigo-600" />
      <div className="flex flex-wrap items-center gap-5 mt-4">
        <Switch id="round-white" checked={white} onChange={setWhite} label="白色背景（关闭则透明）" />
        <Switch id="round-square" checked={square} onChange={setSquare} label="居中裁成正方形" />
      </div>
      <div className="mt-4"><Button icon={Crop} disabled={!source || busy} onClick={generate}>{busy ? "生成中…" : "生成预览"}</Button></div>
      {error && <Notice tone="error" className="mt-3">{error}</Notice>}
      {!source && <p className="ui-note mt-3">请先在上方上传一张图片。</p>}
      <div className="mt-4">
        <ImageResult
          blob={blob}
          filename={source ? `${baseName(source.name)}-rounded.png` : "rounded.png"}
          checker={!white}
          hint="透明区域在预览中显示为棋盘格或白底，导出 PNG 会保留 alpha 通道"
        />
      </div>
    </Panel>
  );
}

export default function ImageRoundPage() {
  const { source, notice, handleFile, clear } = useImageSource();

  return (
    <ToolShell>
      <ImageUploadPanel icon={ImagePlus} source={source} title="选择图片" notice={notice} onFile={handleFile} onClear={clear} />
      <div className="mt-5"><RoundPanel source={source} /></div>
      <p className="ui-note mt-5">
        圆角半径按短边百分比计算，同一套参数换图片也不会走形；关闭白底即导出带 alpha 的圆角 PNG。
      </p>
    </ToolShell>
  );
}
