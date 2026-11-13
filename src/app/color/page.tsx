// app/color/page.tsx
"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { Contrast, Droplet, ImagePlus, Palette, Pipette, Sparkles, Trash2 } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Badge, Button, CopyButton, Notice, Segmented } from "@/components/ui/ToolUI";
import {
  contrastRatio,
  extractPalette,
  harmony,
  parseColor,
  readableText,
  rgbToCmyk,
  rgbToHsl,
  toHex,
  type HarmonyKind,
  type RGB,
} from "./color-utils";

interface EyeDropperResult { sRGBHex: string }
interface EyeDropperInstance { open(): Promise<EyeDropperResult> }
type EyeDropperConstructor = new () => EyeDropperInstance;

const HARMONY_OPTIONS: { value: HarmonyKind; label: string }[] = [
  { value: "complementary", label: "互补色" },
  { value: "analogous", label: "邻近色" },
  { value: "triadic", label: "三角色" },
  { value: "split", label: "分裂互补" },
  { value: "monochromatic", label: "单色渐变" },
];

const SWATCHES = [
  "#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#0F172A", "#64748B", "#FFFFFF",
];

function ColorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
      <span className="text-xs text-slate-500 w-14 shrink-0">{label}</span>
      <input
        readOnly
        value={value}
        aria-label={label}
        className="flex-1 min-w-0 bg-transparent border-0 font-mono text-sm text-slate-800 truncate focus:outline-none"
      />
      <CopyButton value={value} label={`复制 ${label}`} />
    </div>
  );
}

export default function ColorPage() {
  const [input, setInput] = useState("#4F46E5");
  const [contrastBg, setContrastBg] = useState("#FFFFFF");
  const [harmonyKind, setHarmonyKind] = useState<HarmonyKind>("complementary");
  const [palette, setPalette] = useState<RGB[]>([]);
  const [paletteName, setPaletteName] = useState("");
  const [dropStatus, setDropStatus] = useState("");
  const [paletteError, setPaletteError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const rgb = useMemo(() => parseColor(input), [input]);
  const bgRgb = useMemo(() => parseColor(contrastBg) ?? { r: 255, g: 255, b: 255 }, [contrastBg]);
  const hex = rgb ? toHex(rgb) : "";
  const bgHex = toHex(bgRgb);
  const hsl = rgb ? rgbToHsl(rgb) : null;
  const cmyk = rgb ? rgbToCmyk(rgb) : null;
  const ratio = rgb ? contrastRatio(rgb, bgRgb) : 0;
  const harmonyColors = useMemo(() => (rgb ? harmony(rgb, harmonyKind) : []), [rgb, harmonyKind]);

  const formats = rgb && hsl && cmyk ? [
    { label: "HEX", value: hex },
    { label: "RGB", value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
    { label: "HSL", value: `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)` },
    { label: "CMYK", value: `cmyk(${Math.round(cmyk.c)}%, ${Math.round(cmyk.m)}%, ${Math.round(cmyk.y)}%, ${Math.round(cmyk.k)}%)` },
  ] : [];

  const pickScreenColor = async () => {
    const Constructor = (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper;
    if (!Constructor) {
      setDropStatus("当前浏览器不支持屏幕取色，请用 Chrome / Edge，或直接输入色值。");
      return;
    }
    try {
      const result = await new Constructor().open();
      setInput(result.sRGBHex);
      setDropStatus("");
    } catch {
      setDropStatus("已取消取色");
    }
  };

  const readImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setPaletteError("请上传图片文件");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setPaletteError("图片请控制在 15MB 以内");
      return;
    }
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 40_000_000) {
        setPaletteError("图片像素过高，请换一张较小的图");
        return;
      }
      const scale = Math.min(1, 200 / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("画布不可用");
      ctx.drawImage(bitmap, 0, 0, width, height);
      const pixels = ctx.getImageData(0, 0, width, height);
      setPalette(extractPalette(pixels.data, 8));
      setPaletteName(file.name);
      setPaletteError("");
    } catch {
      setPaletteError("图片无法解码，请换一张");
    } finally {
      bitmap?.close();
    }
  };

  const onPaletteChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void readImage(file);
    event.target.value = "";
  };

  const onPaletteDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readImage(file);
  };

  const levels = [
    { label: "AA 正文", pass: ratio >= 4.5, need: "≥ 4.5" },
    { label: "AA 大字", pass: ratio >= 3, need: "≥ 3" },
    { label: "AAA 正文", pass: ratio >= 7, need: "≥ 7" },
    { label: "AAA 大字", pass: ratio >= 4.5, need: "≥ 4.5" },
  ];

  return (
    <ToolShell>
      <div className="space-y-6">
        {/* 当前颜色 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="color-hex" className="ui-label text-sm flex items-center gap-2">
              <Droplet size={16} className="text-indigo-600" /> 当前颜色
            </label>
            <Button variant="secondary" size="sm" icon={Pipette} onClick={() => void pickScreenColor()}>屏幕取色</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="color-hex"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              spellCheck={false}
              placeholder="#4F46E5 或 rgb(79, 70, 229)"
              className="ui-input font-mono text-sm flex-1 min-w-[180px]"
            />
            <input
              type="color"
              value={hex.toLowerCase() || "#4f46e5"}
              onChange={(event) => setInput(event.target.value)}
              aria-label="用取色器选择颜色"
              className="w-12 h-11 p-1 bg-white border border-slate-200 rounded-xl cursor-pointer shrink-0"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setInput(swatch)}
                aria-label={`选用 ${swatch}`}
                title={swatch}
                className="w-7 h-7 rounded-lg border border-slate-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
          {!rgb && <Notice tone="error">无法识别色值。支持 <code className="font-mono">#ABC</code>、<code className="font-mono">#AABBCC</code> 或 <code className="font-mono">rgb(1, 2, 3)</code>。</Notice>}
          {dropStatus && <Notice tone="info">{dropStatus}</Notice>}
        </div>

        {rgb && (
          <>
            <div
              className="h-28 rounded-2xl border border-slate-200 flex items-center justify-center"
              style={{ backgroundColor: hex }}
            >
              <span className="text-2xl font-mono font-semibold tracking-wide" style={{ color: readableText(rgb) }}>{hex}</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {formats.map((format) => <ColorRow key={format.label} {...format} />)}
            </div>

            {/* WCAG 对比度 */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <span className="ui-label text-sm flex items-center gap-2">
                <Contrast size={16} className="text-indigo-600" /> 对比度检测（WCAG 2.1）
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <div className="space-y-1">
                  <label htmlFor="color-bg" className="text-xs text-slate-500 block">背景色</label>
                  <div className="flex items-center gap-2">
                    <input id="color-bg" type="color" value={bgHex.toLowerCase()} onChange={(event) => setContrastBg(event.target.value)} className="w-10 h-9 p-1 bg-white border border-slate-200 rounded-lg cursor-pointer" />
                    <input
                      value={contrastBg}
                      onChange={(event) => setContrastBg(event.target.value)}
                      aria-label="背景色值"
                      className="ui-input ui-input-sm font-mono text-xs w-32"
                    />
                  </div>
                </div>
                <div className="flex-1 min-w-[180px] p-4 rounded-xl border border-slate-200" style={{ backgroundColor: contrastBg }}>
                  <div className="text-base font-semibold" style={{ color: hex }}>示例文字 Aa 中文 123</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={ratio >= 4.5 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}>
                  对比度 {ratio.toFixed(2)} : 1
                </Badge>
                {levels.map((level) => (
                  <Badge key={level.label} className={level.pass ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}>
                    {level.label} {level.pass ? "通过" : `未达标 ${level.need}`}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 配色方案 */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <span className="ui-label text-sm flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-600" /> 配色方案
              </span>
              <Segmented<HarmonyKind>
                label="配色方案"
                value={harmonyKind}
                onChange={setHarmonyKind}
                options={HARMONY_OPTIONS}
              />
              <div className="flex gap-2 overflow-x-auto pb-1">
                {harmonyColors.map((color, index) => {
                  const value = toHex(color);
                  return (
                    <button
                      key={`${value}-${index}`}
                      type="button"
                      onClick={() => setInput(value)}
                      title={`选用 ${value}`}
                      aria-label={`选用 ${value}`}
                      className="flex-1 min-w-[78px] rounded-xl border border-slate-200 overflow-hidden hover:border-indigo-400 transition-colors"
                    >
                      <span className="block h-16" style={{ backgroundColor: value }} />
                      <span className="block py-1.5 font-mono text-xs text-slate-600">{value}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* 图片取色 */}
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="ui-label text-sm flex items-center gap-2">
              <Palette size={16} className="text-indigo-600" /> 从图片提取配色
            </span>
            {paletteName && <span className="text-xs text-slate-500 truncate max-w-[180px]">{paletteName}</span>}
          </div>
          <input id="color-image" type="file" accept="image/*" className="hidden" onChange={onPaletteChange} />
          <button
            type="button"
            onClick={() => document.getElementById("color-image")?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onPaletteDrop}
            className={`w-full p-6 border-2 border-dashed rounded-2xl text-center transition-colors ${
              dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50 hover:border-indigo-300"
            }`}
          >
            <ImagePlus size={24} className="mx-auto text-indigo-600 mb-2" />
            <div className="text-sm font-semibold text-slate-700">点击选择或拖拽图片，提取主色调</div>
            <div className="text-xs text-slate-500 mt-1">图片只在本地缩略分析，最大 15MB</div>
          </button>
          {paletteError && <Notice tone="error">{paletteError}</Notice>}
          {palette.length > 0 && (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {palette.map((color, index) => {
                  const value = toHex(color);
                  return (
                    <button
                      key={`${value}-${index}`}
                      type="button"
                      onClick={() => setInput(value)}
                      title={`选用 ${value}`}
                      aria-label={`选用 ${value}`}
                      className="flex-1 min-w-[78px] rounded-xl border border-slate-200 overflow-hidden hover:border-indigo-400 transition-colors"
                    >
                      <span className="block h-16" style={{ backgroundColor: value }} />
                      <span className="block py-1.5 font-mono text-xs text-slate-600">{value}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon={Trash2} onClick={() => { setPalette([]); setPaletteName(""); }}>清空配色</Button>
                <CopyButton value={palette.map(toHex).join("\n")} label="复制全部色值" />
              </div>
            </>
          )}
        </div>

        <Notice tone="tip">
          HSL / CMYK 换算按标准公式计算，屏幕取色依赖浏览器的 <code className="font-mono">EyeDropper</code> API（Chrome / Edge 支持），Safari 与 Firefox 请手动输入色值。
        </Notice>
      </div>
    </ToolShell>
  );
}
