// app/image-round/page.tsx
"use client";

import { useState } from "react";
import { Crop, ImagePlus, Square } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice } from "@/components/ui/ToolUI";
import { OptionCard } from "@/components/ui/OptionCard";
import { ImageUploadPanel } from "@/components/ui/ImageDrop";
import { ImageResult } from "@/components/ui/ImageResult";
import { baseName, canvasToBlob, type ImageSource } from "@/lib/image-io";
import { drawRounded } from "@/lib/image-canvas";
import { useImageSource } from "@/lib/use-image-source";

function RoundTool({ source }: { source: ImageSource | null }) {
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
    <>
      <div className="ui-form-grid">
        <div>
          <label htmlFor="round-radius" className="ui-label text-sm block mb-2">圆角半径 {radius}%（按短边计算）</label>
          <input
            id="round-radius"
            type="range"
            min={0}
            max={50}
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value))}
            className="w-full accent-indigo-600"
          />
        </div>
        <OptionCard
          checked={white}
          onChange={setWhite}
          title="白色背景"
          desc="关闭则导出透明 PNG，可放在任意底色上"
          icon={Square}
        />
        <OptionCard
          checked={square}
          onChange={setSquare}
          title="居中裁成正方形"
          desc="按短边裁切，输出 1:1 头像尺寸"
          icon={Crop}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button icon={Crop} disabled={!source || busy} onClick={generate}>
          {busy ? "生成中…" : "生成预览"}
        </Button>
        {!source && <span className="text-xs text-slate-500">先上传一张图片</span>}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <ImageResult
        blob={blob}
        filename={source ? `${baseName(source.name)}-rounded.png` : "rounded.png"}
        checker={!white}
        hint="透明区域在预览中显示为棋盘格，导出 PNG 会保留 alpha 通道"
      />
    </>
  );
}

export default function ImageRoundPage() {
  const { source, notice, handleFile, clear } = useImageSource();

  return (
    <ToolShell>
      <div className="space-y-4">
        <ImageUploadPanel icon={ImagePlus} source={source} notice={notice} onFile={handleFile} onClear={clear} />
        <RoundTool source={source} />
        <p className="ui-note">
          圆角半径按短边百分比计算，同一套参数换图片也不会走形；关闭白底即导出带 alpha 的圆角 PNG。
        </p>
      </div>
    </ToolShell>
  );
}
