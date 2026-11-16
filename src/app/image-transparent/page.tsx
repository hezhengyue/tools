// app/image-transparent/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eraser, ImagePlus, Pipette } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { ImageDropZone, ImageSourceBar } from "@/components/ui/ImageDrop";
import { Button, Notice, Panel, Segmented, Switch } from "@/components/ui/ToolUI";
import { baseName, canvasToBlob, downloadBlob, loadImageFile, type ImageSource } from "@/lib/image-io";
import {
  detectBackground, hexToRgb, removeBackground, rgbToHex, type RemoveResult,
} from "./transparent";

const TOLERANCE_DEFAULT = 14;
const FEATHER_DEFAULT = "1";

export default function ImageTransparentPage() {
  const [source, setSource] = useState<ImageSource | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [tolerance, setTolerance] = useState(TOLERANCE_DEFAULT);
  const [feather, setFeather] = useState(FEATHER_DEFAULT);
  const [colorHex, setColorHex] = useState("#ffffff");
  const [alsoInside, setAlsoInside] = useState(false);
  const [stats, setStats] = useState<RemoveResult | null>(null);
  const [busy, setBusy] = useState(false);

  const sourceRef = useRef<ImageSource | null>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<HTMLCanvasElement | null>(null);
  const resultRef = useRef<HTMLCanvasElement | null>(null);
  const loadGenRef = useRef(0);

  useEffect(() => { sourceRef.current = source; }, [source]);
  useEffect(() => () => {
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
  }, []);

  /** 原图先画进离屏画布：吸色和重算都从这里取，不受已抠掉区域影响 */
  const prepareOriginal = (img: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, img.naturalWidth);
    canvas.height = Math.max(1, img.naturalHeight);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("当前浏览器不支持 Canvas 2D");
    ctx.drawImage(img, 0, 0);
    originalRef.current = canvas;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return detectBackground(data.data, canvas.width, canvas.height);
  };

  const handleFile = useCallback(async (file: File) => {
    const gen = ++loadGenRef.current;
    setError("");
    setNotice("");
    try {
      const next = await loadImageFile(file);
      if (gen !== loadGenRef.current) {
        URL.revokeObjectURL(next.url);
        return;
      }
      const previous = sourceRef.current;
      sourceRef.current = next;
      setSource(next);
      if (previous && previous.url !== next.url) URL.revokeObjectURL(previous.url);
      const background = prepareOriginal(next.img);
      setColorHex(rgbToHex(background));
    } catch (cause) {
      if (gen === loadGenRef.current) setNotice(cause instanceof Error ? cause.message : "图片加载失败");
    }
  }, []);

  // 粘贴图片也能用
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"));
      if (file) void handleFile(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [handleFile]);

  // 参数一变就重算：纯色底抠图在十几毫秒内完成，不需要「生成」按钮
  useEffect(() => {
    if (!source) return;
    const timer = setTimeout(() => {
      const original = originalRef.current;
      if (!original) return;
      setBusy(true);
      try {
        const work = document.createElement("canvas");
        work.width = original.width;
        work.height = original.height;
        const ctx = work.getContext("2d");
        if (!ctx) throw new Error("当前浏览器不支持 Canvas 2D");
        ctx.drawImage(original, 0, 0);
        const result = removeBackground(work, {
          tolerance,
          feather: Number(feather),
          color: hexToRgb(colorHex),
          alsoInside,
        });
        resultRef.current = work;
        const preview = previewRef.current;
        if (preview) {
          preview.width = work.width;
          preview.height = work.height;
          const previewCtx = preview.getContext("2d");
          previewCtx?.drawImage(work, 0, 0);
        }
        setStats(result);
        setError("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "处理失败");
      } finally {
        setBusy(false);
      }
    }, 90);
    return () => clearTimeout(timer);
  }, [source, tolerance, feather, colorHex, alsoInside]);

  /** 点预览吸色：取的是原图像素，已抠成透明的区域也能取回颜色 */
  const pickColor = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = previewRef.current;
    const original = originalRef.current;
    if (!canvas || !original) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / rect.width * original.width);
    const y = Math.floor((event.clientY - rect.top) / rect.height * original.height);
    const ctx = original.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const [r, g, b] = ctx.getImageData(Math.min(x, original.width - 1), Math.min(y, original.height - 1), 1, 1).data;
    setColorHex(rgbToHex({ r, g, b }));
  };

  const download = async () => {
    const canvas = resultRef.current;
    if (!canvas || !source) return;
    try {
      const blob = await canvasToBlob(canvas);
      downloadBlob(blob, `${baseName(source.name)}-transparent.png`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导出失败");
    }
  };

  const clear = () => {
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
    sourceRef.current = null;
    originalRef.current = null;
    resultRef.current = null;
    setSource(null);
    setStats(null);
  };

  const removedPercent = stats ? Math.round(stats.removedRatio * 100) : 0;

  return (
    <ToolShell>
      <Panel icon={ImagePlus} title="选择图片">
        {source ? (
          <ImageSourceBar
            source={source}
            onReplace={() => replaceRef.current?.click()}
            onClear={clear}
          />
        ) : (
          <ImageDropZone onFile={(file) => void handleFile(file)} />
        )}
        {notice && <Notice tone="error" className="mt-3">{notice}</Notice>}
        <input
          ref={replaceRef}
          type="file"
          accept="image/*,.svg"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
      </Panel>

      {source && (
        <>
          <Panel icon={Eraser} title="抠图参数" className="mt-5">
            <div className="ui-form-grid">
              <div>
                <label htmlFor="tolerance" className="ui-label text-sm block mb-2">颜色容差 {tolerance}</label>
                <input
                  id="tolerance"
                  type="range"
                  min={1}
                  max={60}
                  value={tolerance}
                  onChange={(event) => setTolerance(Number(event.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
              <div>
                <span className="ui-label text-sm block mb-2">边缘羽化</span>
                <Segmented
                  label="边缘羽化档位"
                  value={feather}
                  onChange={setFeather}
                  options={[
                    { value: "0", label: "关闭" },
                    { value: "1", label: "轻微" },
                    { value: "2", label: "柔和" },
                    { value: "3", label: "最柔" },
                  ]}
                />
              </div>
              <div>
                <label htmlFor="bg-color" className="ui-label text-sm block mb-2">背景色</label>
                <div className="flex items-center gap-2">
                  <input
                    id="bg-color"
                    type="color"
                    value={colorHex}
                    onChange={(event) => setColorHex(event.target.value)}
                    className="w-11 h-11 p-1 bg-white border border-slate-200 rounded-xl cursor-pointer"
                  />
                  <span className="font-mono text-sm text-slate-600">{colorHex.toUpperCase()}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Pipette}
                    onClick={() => {
                      if (!source) return;
                      setColorHex(rgbToHex(prepareOriginal(source.img)));
                    }}
                  >
                    自动取四角
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Switch
                id="also-inside"
                checked={alsoInside}
                onChange={setAlsoInside}
                label="同时删除图内同色区域"
                hint="默认只删与四边连通的部分，字母 O 这类闭环内部会保留"
              />
            </div>

            <p className="ui-note mt-3">
              白底 JPEG 有噪点时把容差调到 20~30；纯色插画设 10 左右即可。渐变或多色照片不适用本工具。
            </p>
          </Panel>

          <Panel icon={ImagePlus} title="预览与导出" className="mt-5">
            <div className="ui-editor ui-checker rounded-xl border border-slate-200 p-3 flex items-center justify-center overflow-auto">
              <canvas
                ref={previewRef}
                onClick={pickColor}
                title="点击画面可取该处颜色作为背景色"
                className="max-w-full max-h-[60vh] object-contain cursor-crosshair"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
              <div className="text-xs text-slate-500">
                背景色 {stats ? rgbToHex(stats.background).toUpperCase() : "—"} ·
                已移除 {removedPercent}% 像素 ·
                {busy ? " 处理中…" : ` 耗时 ${stats?.elapsed ?? 0} ms`}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setColorHex("#ffffff");
                    setTolerance(TOLERANCE_DEFAULT);
                    setFeather(FEATHER_DEFAULT);
                    setAlsoInside(false);
                  }}
                >
                  恢复默认
                </Button>
                <Button icon={Download} onClick={() => void download()}>下载透明 PNG</Button>
              </div>
            </div>

            {removedPercent === 0 && (
              <Notice tone="tip" className="mt-3">
                没有识别到可移除的背景：调大颜色容差，或点画面上的底色手动吸色。
              </Notice>
            )}
            {error && <Notice tone="error" className="mt-3">{error}</Notice>}
          </Panel>
        </>
      )}

      <p className="ui-note mt-5">
        抠图在本机完成，图片不会上传。导出为带 alpha 通道的 PNG，可直接用于 logo、图标与浅色/深色背景。
      </p>
    </ToolShell>
  );
}
