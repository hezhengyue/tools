// app/qrcode/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import {
  Camera,
  Contact,
  Copy,
  Download,
  ImagePlus,
  Layers,
  Link2,
  QrCode,
  ScanLine,
  Trash2,
  Wifi,
} from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice, OutputBlock, Segmented, Switch } from "@/components/ui/ToolUI";

type Tab = "generate" | "scan";
type ContentKind = "text" | "wifi" | "vcard";
type Level = "L" | "M" | "Q" | "H";
type ScanMode = "upload" | "camera";

const LEVELS: { value: Level; label: string; desc: string }[] = [
  { value: "L", label: "L", desc: "约 7% 容错" },
  { value: "M", label: "M", desc: "约 15% 容错" },
  { value: "Q", label: "Q", desc: "约 25% 容错" },
  { value: "H", label: "H", desc: "约 30% 容错，适合加 logo" },
];

function escapeWifi(value: string) {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

function escapeVCard(value: string) {
  return value.replace(/([\\;,])/g, "\\$1").replace(/\r?\n/g, "\\n");
}

interface VCardFields {
  name: string;
  phone: string;
  email: string;
  org: string;
  url: string;
}

function buildVCard(fields: VCardFields) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${escapeVCard(fields.name)}`];
  if (fields.org) lines.push(`ORG:${escapeVCard(fields.org)}`);
  if (fields.phone) lines.push(`TEL;TYPE=CELL:${escapeVCard(fields.phone)}`);
  if (fields.email) lines.push(`EMAIL:${escapeVCard(fields.email)}`);
  if (fields.url) lines.push(`URL:${escapeVCard(fields.url)}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

/** 保存一个 Blob 为文件；图片导出属于页面级动作，不走文本 OutputBlock */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** 在给定画布上解析图片中的二维码；先缩放到 ~1200px 识别，失败再试更高分辨率 */
function decodeFromCanvas(canvas: HTMLCanvasElement, image: ImageBitmap) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  for (const maxSide of [1200, 2400]) {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height);
    const found = jsQR(pixels.data, width, height, { inversionAttempts: "attemptBoth" });
    if (found) return found.data;
    if (scale === 1) break;
  }
  return null;
}

export default function QrCodePage() {
  const [tab, setTab] = useState<Tab>("generate");
  const [kind, setKind] = useState<ContentKind>("text");
  const [text, setText] = useState("https://example.com");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [encryption, setEncryption] = useState("WPA");
  const [hidden, setHidden] = useState(false);
  const [vcard, setVCard] = useState<VCardFields>({ name: "", phone: "", email: "", org: "", url: "" });

  const [level, setLevel] = useState<Level>("M");
  const [size, setSize] = useState(320);
  const [margin, setMargin] = useState(2);
  const [fg, setFg] = useState("#0f172a");
  const [bg, setBg] = useState("#ffffff");
  const [logoName, setLogoName] = useState("");
  const [logoVersion, setLogoVersion] = useState(0);
  const [hasQr, setHasQr] = useState(false);
  const [genError, setGenError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const [batchText, setBatchText] = useState("");
  const [batchUrl, setBatchUrl] = useState("");
  const [batchBusy, setBatchBusy] = useState(false);

  const [scanMode, setScanMode] = useState<ScanMode>("upload");
  const [scanResult, setScanResult] = useState("");
  const [scanError, setScanError] = useState("");
  const [cameraOn, setCameraOn] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoRef = useRef<ImageBitmap | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const content = useMemo(() => {
    if (kind === "text") return text.trim();
    if (kind === "wifi") {
      if (!ssid.trim()) return "";
      return `WIFI:T:${encryption};S:${escapeWifi(ssid)};P:${escapeWifi(password)};H:${hidden ? "true" : "false"};;`;
    }
    if (!vcard.name.trim()) return "";
    return buildVCard(vcard);
  }, [kind, text, ssid, password, encryption, hidden, vcard]);

  const options = useMemo(
    () => ({
      errorCorrectionLevel: level,
      width: size,
      margin,
      color: { dark: fg, light: bg },
    }),
    [level, size, margin, fg, bg]
  );

  useEffect(() => {
    let cancelled = false;
    // 放进微任务，避免在 effect 体内同步 setState
    queueMicrotask(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!content) {
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!cancelled) {
          setHasQr(false);
          setGenError("");
        }
        return;
      }
      try {
        await QRCode.toCanvas(canvas, content, options);
        if (cancelled) return;
        if (ctx && logoRef.current) {
          const side = canvas.width * 0.2;
          const x = (canvas.width - side) / 2;
          const y = (canvas.height - side) / 2;
          ctx.fillStyle = bg;
          ctx.fillRect(x - 5, y - 5, side + 10, side + 10);
          ctx.drawImage(logoRef.current, x, y, side, side);
        }
        if (!cancelled) {
          setHasQr(true);
          setGenError("");
        }
      } catch (error) {
        if (!cancelled) {
          setHasQr(false);
          setGenError(error instanceof Error ? error.message : "生成失败，请缩短内容或降低容错等级");
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [content, options, bg, logoVersion]);

  useEffect(() => () => {
    logoRef.current?.close();
    logoRef.current = null;
  }, []);

  const handleLogo = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setGenError("Logo 只支持图片文件");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setGenError("Logo 图片请控制在 2MB 以内");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      logoRef.current?.close();
      logoRef.current = bitmap;
      setLogoName(file.name);
      setLogoVersion((version) => version + 1);
      setGenError("");
    } catch {
      setGenError("Logo 图片无法解码，请换一张");
    }
  }, []);

  const removeLogo = () => {
    logoRef.current?.close();
    logoRef.current = null;
    setLogoName("");
    setLogoVersion((version) => version + 1);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasQr) return;
    canvas.toBlob((blob) => {
      if (blob) saveBlob(blob, "qrcode.png");
    }, "image/png");
  };

  const downloadSvg = async () => {
    if (!content || !hasQr) return;
    try {
      const svg = await QRCode.toString(content, { ...options, type: "svg" });
      saveBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), "qrcode.svg");
    } catch (error) {
      setGenError(error instanceof Error ? error.message : "SVG 导出失败");
    }
  };

  const copyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasQr) return;
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      setCopyStatus("当前浏览器不支持复制图片，请使用下载");
      return;
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyStatus("图片已复制到剪贴板");
    } catch {
      setCopyStatus("复制失败，请改用下载 PNG");
    }
  };

  const buildBatch = async () => {
    const lines = batchText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 50);
    if (!lines.length) {
      setBatchUrl("");
      return;
    }
    setBatchBusy(true);
    try {
      const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(lines.length))));
      const rows = Math.ceil(lines.length / columns);
      const cell = 220;
      const label = 34;
      const pad = 16;
      const sheet = document.createElement("canvas");
      sheet.width = columns * (cell + pad) + pad;
      sheet.height = rows * (cell + label + pad) + pad;
      const ctx = sheet.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sheet.width, sheet.height);
      const tmp = document.createElement("canvas");
      for (let index = 0; index < lines.length; index += 1) {
        await QRCode.toCanvas(tmp, lines[index], {
          errorCorrectionLevel: "M",
          width: cell,
          margin: 1,
          color: { dark: fg, light: bg },
        });
        const col = index % columns;
        const row = Math.floor(index / columns);
        const x = pad + col * (cell + pad);
        const y = pad + row * (cell + label + pad);
        ctx.drawImage(tmp, x, y);
        ctx.fillStyle = "#334155";
        ctx.font = "13px sans-serif";
        ctx.fillText(lines[index].slice(0, 26), x, y + cell + 20, cell);
      }
      setBatchUrl(sheet.toDataURL("image/png"));
      setScanError("");
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "批量生成失败");
    } finally {
      setBatchBusy(false);
    }
  };

  const scanFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setScanError("请上传图片文件（PNG / JPG / WEBP 等）");
      setScanResult("");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setScanError("图片请控制在 15MB 以内");
      setScanResult("");
      return;
    }
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const found = decodeFromCanvas(canvas, bitmap);
      setScanResult(found ?? "");
      setScanError(found ? "" : "没有识别到二维码，请换一张更清晰、码占画面更大的图片");
    } catch {
      setScanResult("");
      setScanError("图片无法解码，请换一张");
    } finally {
      bitmap?.close();
    }
  }, []);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void scanFile(file);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void scanFile(file);
  };

  // 摄像头扫描：每 ~200ms 抽一帧交给 jsQR，识别成功即关摄像头
  useEffect(() => {
    if (!cameraOn || tab !== "scan") return;
    let stopped = false;
    let raf = 0;
    let last = 0;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const canvas = document.createElement("canvas");
        const tick = (timestamp: number) => {
          if (stopped) return;
          raf = requestAnimationFrame(tick);
          if (timestamp - last < 200 || video.readyState < 2 || !video.videoWidth) return;
          last = timestamp;
          const width = Math.min(640, video.videoWidth);
          const height = Math.round((width * video.videoHeight) / video.videoWidth);
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, width, height);
          const pixels = ctx.getImageData(0, 0, width, height);
          const found = jsQR(pixels.data, width, height, { inversionAttempts: "attemptBoth" });
          if (found && !stopped) {
            setScanResult(found.data);
            setScanError("");
            setCameraOn(false);
          }
        };
        raf = requestAnimationFrame(tick);
      } catch (error) {
        if (!stopped) {
          setScanError(`无法打开摄像头：${error instanceof Error ? error.message : String(error)}`);
          setCameraOn(false);
        }
      }
    };

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraOn, tab]);

  return (
    <ToolShell>
      <div className="space-y-6">
        <Segmented<Tab>
          label="功能模式"
          value={tab}
          onChange={(next) => { setTab(next); setScanError(""); setCopyStatus(""); }}
          options={[
            { value: "generate", label: "生成二维码", icon: QrCode },
            { value: "scan", label: "识别二维码", icon: ScanLine },
          ]}
        />

        {tab === "generate" ? (
          <>
            <div className="space-y-3">
              <span className="ui-label text-sm">内容类型</span>
              <Segmented<ContentKind>
                label="内容类型"
                value={kind}
                onChange={setKind}
                options={[
                  { value: "text", label: "文本 / 网址", icon: Link2 },
                  { value: "wifi", label: "WiFi", icon: Wifi },
                  { value: "vcard", label: "名片", icon: Contact },
                ]}
              />
            </div>

            {kind === "text" && (
              <div className="space-y-2">
                <label htmlFor="qr-text" className="ui-label text-sm">二维码内容</label>
                <textarea
                  id="qr-text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={3}
                  placeholder="输入网址或任意文本…"
                  className="ui-textarea"
                />
                <p className="text-xs text-slate-500">内容越长码越密，建议先用 M 或 L 容错等级。</p>
              </div>
            )}

            {kind === "wifi" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="qr-ssid" className="ui-label text-sm">网络名称 SSID</label>
                  <input id="qr-ssid" value={ssid} onChange={(event) => setSsid(event.target.value)} placeholder="例如 Office-5G" className="ui-input" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="qr-pass" className="ui-label text-sm">密码</label>
                  <input id="qr-pass" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="开放网络可留空" className="ui-input" />
                </div>
                <div className="space-y-2">
                  <span className="ui-label text-sm">加密方式</span>
                  <Segmented
                    label="加密方式"
                    value={encryption}
                    onChange={setEncryption}
                    options={[
                      { value: "WPA", label: "WPA / WPA2" },
                      { value: "WEP", label: "WEP" },
                      { value: "nopass", label: "无密码" },
                    ]}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <Switch id="qr-hidden" checked={hidden} onChange={setHidden} label="隐藏网络" hint="H:true" />
                </div>
              </div>
            )}

            {kind === "vcard" && (
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ["name", "姓名", "例如 张三"],
                  ["phone", "手机号", "例如 13800138000"],
                  ["email", "邮箱", "例如 hi@example.com"],
                  ["org", "公司 / 组织", "选填"],
                  ["url", "个人主页", "选填"],
                ] as const).map(([key, label, placeholder]) => (
                  <div key={key} className="space-y-2">
                    <label htmlFor={`qr-${key}`} className="ui-label text-sm">{label}</label>
                    <input
                      id={`qr-${key}`}
                      value={vcard[key]}
                      onChange={(event) => setVCard((prev) => ({ ...prev, [key]: event.target.value }))}
                      placeholder={placeholder}
                      className="ui-input"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* 外观设置 */}
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <div className="space-y-2">
                <span className="ui-label text-sm">容错等级</span>
                <Segmented<Level>
                  label="容错等级"
                  value={level}
                  onChange={setLevel}
                  options={LEVELS.map((item) => ({ value: item.value, label: item.label }))}
                />
                <p className="text-xs text-slate-500">{LEVELS.find((item) => item.value === level)?.desc}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="qr-size" className="ui-label text-sm">图片尺寸：{size}px</label>
                  <input
                    id="qr-size"
                    type="range"
                    min={128}
                    max={1024}
                    step={32}
                    value={size}
                    onChange={(event) => setSize(Number(event.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="qr-margin" className="ui-label text-sm">静区边距：{margin}</label>
                  <input
                    id="qr-margin"
                    type="range"
                    min={0}
                    max={8}
                    step={1}
                    value={margin}
                    onChange={(event) => setMargin(Number(event.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="qr-fg" className="ui-label text-sm">前景色</label>
                  <div className="flex items-center gap-2">
                    <input id="qr-fg" type="color" value={fg} onChange={(event) => setFg(event.target.value)} className="w-11 h-10 p-1 bg-white border border-slate-200 rounded-lg cursor-pointer" />
                    <span className="font-mono text-sm text-slate-600">{fg}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="qr-bg" className="ui-label text-sm">背景色</label>
                  <div className="flex items-center gap-2">
                    <input id="qr-bg" type="color" value={bg} onChange={(event) => setBg(event.target.value)} className="w-11 h-10 p-1 bg-white border border-slate-200 rounded-lg cursor-pointer" />
                    <span className="font-mono text-sm text-slate-600">{bg}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="ui-label text-sm">中心 Logo（选填，仅作用于 PNG）</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleLogo(file);
                    event.target.value = "";
                  }} />
                  <Button variant="secondary" size="sm" icon={ImagePlus} onClick={() => logoInputRef.current?.click()}>
                    {logoName ? "更换 Logo" : "选择 Logo"}
                  </Button>
                  {logoName && (
                    <>
                      <span className="text-xs text-slate-500 truncate max-w-[160px]">{logoName}</span>
                      <Button variant="ghost" size="sm" icon={Trash2} onClick={removeLogo}>移除</Button>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-500">建议搭配 H 容错等级，Logo 会占据中心 20% 区域。</p>
              </div>
            </div>

            {genError && <Notice tone="error">{genError}</Notice>}

            {/* 预览与导出 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="ui-label text-sm">实时预览</span>
                {content && <span className="text-xs text-slate-500">{content.length} 字符</span>}
              </div>
              <div className="flex justify-center p-5 bg-slate-50 border border-slate-200 rounded-2xl">
                <canvas ref={canvasRef} className="max-w-full h-auto rounded-lg" aria-label="二维码预览" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button icon={Download} onClick={downloadPng} disabled={!hasQr}>下载 PNG</Button>
                <Button variant="secondary" icon={Download} onClick={() => void downloadSvg()} disabled={!hasQr}>下载 SVG</Button>
                <Button variant="secondary" icon={Copy} onClick={() => void copyImage()} disabled={!hasQr}>复制图片</Button>
              </div>
              {copyStatus && <Notice tone={copyStatus.startsWith("图片已") ? "success" : "error"}>{copyStatus}</Notice>}
            </div>

            {/* 批量生成 */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <span className="ui-label text-sm flex items-center gap-2"><Layers size={16} className="text-indigo-600" /> 批量生成（每行一条，最多 50 条）</span>
              <textarea
                value={batchText}
                onChange={(event) => setBatchText(event.target.value)}
                rows={3}
                placeholder={"https://example.com/a\nhttps://example.com/b\n产品编号 A-1001"}
                className="ui-textarea"
                aria-label="批量内容，每行一条"
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => void buildBatch()} disabled={batchBusy || !batchText.trim()}>
                  {batchBusy ? "生成中…" : "生成合并图"}
                </Button>
                {batchUrl && (
                  <Button variant="secondary" size="sm" icon={Download} onClick={() => {
                    const anchor = document.createElement("a");
                    anchor.href = batchUrl;
                    anchor.download = "qrcodes-sheet.png";
                    anchor.click();
                  }}>下载合并图</Button>
                )}
              </div>
              {batchUrl && (
                <img src={batchUrl} alt="批量生成的二维码合并预览" className="w-full max-h-80 object-contain bg-white border border-slate-200 rounded-xl" />
              )}
            </div>

            <Notice tone="tip">二维码内容会直接写进码里，请不要把密码、密钥等敏感信息做成二维码后公开传播。</Notice>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <span className="ui-label text-sm">识别方式</span>
              <Segmented<ScanMode>
                label="识别方式"
                value={scanMode}
                onChange={(next) => { setScanMode(next); setScanError(""); }}
                options={[
                  { value: "upload", label: "上传图片", icon: ImagePlus },
                  { value: "camera", label: "摄像头", icon: Camera },
                ]}
              />
            </div>

            {scanMode === "upload" ? (
              <div className="space-y-3">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={onDrop}
                  className="w-full p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors text-center"
                >
                  <ImagePlus size={28} className="mx-auto text-indigo-600 mb-2" />
                  <div className="text-sm font-semibold text-slate-700">点击选择或拖拽二维码图片到这里</div>
                  <div className="text-xs text-slate-500 mt-1">支持 PNG / JPG / WEBP，最大 15MB</div>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {cameraOn && (
                  <video ref={videoRef} muted playsInline className="w-full max-w-md mx-auto rounded-2xl bg-slate-900 aspect-video object-cover" aria-label="摄像头实时画面" />
                )}
                <Button
                  icon={Camera}
                  onClick={() => { setScanError(""); if (cameraOn) setCameraOn(false); else setCameraOn(true); }}
                >
                  {cameraOn ? "关闭摄像头" : "打开摄像头扫码"}
                </Button>
                <p className="text-xs text-slate-500">摄像头画面只在本机逐帧分析，不会录制或上传。</p>
              </div>
            )}

            {scanError && <Notice tone="error">{scanError}</Notice>}

            <OutputBlock
              label="识别结果"
              hint="可复制后直接打开或粘贴"
              value={scanResult}
              copyLabel="复制识别结果"
              filename="qrcode-decoded.txt"
              placeholder="识别到的内容会出现在这里…"
              minHeight="min-h-[130px]"
            />

            <Notice tone="tip">
              识别由 <code className="font-mono">jsQR</code> 在本地完成。若失败，请裁剪掉多余背景、保证码完整且不过度模糊。
            </Notice>
          </>
        )}
      </div>
    </ToolShell>
  );
}
