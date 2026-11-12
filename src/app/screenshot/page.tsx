"use client";

// src/app/screenshot/page.tsx
// 在线截图：浏览器原生 getDisplayMedia 拿到共享画面 → 冻结一帧铺成全屏画布 →
// 直接拖动框选区域（松开即完成，自动复制到剪贴板）。全程本地，不上传任何数据。

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Camera,
  Check,
  Copy,
  Crop as CropIcon,
  Download,
  Image as ImageIcon,
  Keyboard,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice, Panel } from "@/components/ui/ToolUI";

interface Shot {
  url: string;
  blob: Blob;
  width: number;
  height: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DELAY_OPTIONS = [0, 3, 5] as const;

/** 小于该尺寸的框选视为误触 */
const MIN_CROP = 8;

/** 页面内快捷键（系统级全局热键浏览器不允许网页注册） */
const HOTKEY_LABEL = "Ctrl / ⌘ + Shift + X";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function fileStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
}

/** 等 <video> 真正解码出画面（浏览器选完共享源后有一小段空窗） */
async function waitForVideoReady(
  getVideo: () => HTMLVideoElement | null,
  timeout = 4000
): Promise<HTMLVideoElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const video = getVideo();
    if (video && video.videoWidth > 0 && video.videoHeight > 0) return video;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return null;
}

export default function ScreenshotPage() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [frameUrl, setFrameUrl] = useState("");
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [selRect, setSelRect] = useState<Rect | null>(null);
  const [delay, setDelay] = useState<number>(0);
  const [countdown, setCountdown] = useState(0);
  const [autoCopy, setAutoCopy] = useState(true);
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameUrlRef = useRef<string | null>(null);
  const imageWrapRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shotUrlRef = useRef<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const selRef = useRef<Rect | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markCopied = useCallback(() => {
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1600);
  }, []);

  /** 用新的 Blob 替换结果图，并释放上一张的 ObjectURL */
  const applyBlob = useCallback((blob: Blob, width: number, height: number) => {
    if (shotUrlRef.current) URL.revokeObjectURL(shotUrlRef.current);
    const url = URL.createObjectURL(blob);
    shotUrlRef.current = url;
    setShot({ url, blob, width, height });
    setCropRect(null);
    setCropMode(false);
  }, []);

  /** 退出框选：释放冻结帧，收起遮罩 */
  const exitSelection = useCallback(() => {
    if (frameUrlRef.current) {
      URL.revokeObjectURL(frameUrlRef.current);
      frameUrlRef.current = null;
    }
    frameCanvasRef.current = null;
    setFrameUrl("");
    setSelecting(false);
    setSelRect(null);
    selRef.current = null;
    dragStartRef.current = null;
  }, []);

  /** 停止共享（结果图保留） */
  const stopShare = useCallback(() => {
    if (delayTimerRef.current) {
      clearInterval(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    setCountdown(0);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  // 卸载：停采集、停定时器、释放所有 ObjectURL
  useEffect(
    () => () => {
      if (delayTimerRef.current) clearInterval(delayTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (shotUrlRef.current) URL.revokeObjectURL(shotUrlRef.current);
      shotUrlRef.current = null;
      if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
      frameUrlRef.current = null;
    },
    []
  );

  // 把共享流接到 <video> 上（拿到流之后才渲染该元素）
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {
      // 自动播放被拦截不影响取帧
    });
  }, [stream]);

  // 框选时锁滚动，避免滚轮把遮罩带跑
  useEffect(() => {
    if (!selecting) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [selecting]);

  const copyBlob = useCallback(async (blob: Blob): Promise<boolean> => {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || "image/png"]: blob }),
      ]);
      return true;
    } catch {
      return false;
    }
  }, []);

  /** 没有共享流时先申请；已有则直接复用（可连续截图） */
  const ensureStream = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true;
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== "function"
    ) {
      setError(
        "当前浏览器不支持屏幕捕获。请使用最新版 Chrome / Edge / Firefox，并在 HTTPS 或 localhost 下打开本页。"
      );
      return false;
    }
    try {
      const next = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      streamRef.current = next;
      setStream(next);
      next.getVideoTracks()[0]?.addEventListener("ended", () => {
        streamRef.current = null;
        setStream(null);
        exitSelection();
      });
      return true;
    } catch (err) {
      const e = err as DOMException;
      if (e?.name === "NotAllowedError") {
        setError("你取消了画面选择，或浏览器未授予屏幕捕获权限。");
      } else if (e?.name === "NotReadableError") {
        setError("系统拒绝了屏幕捕获请求，可能有其它程序正在录制屏幕。");
      } else {
        setError(`无法开始屏幕捕获：${e?.message || "未知错误"}`);
      }
      return false;
    }
  }, [exitSelection]);

  /** 冻结当前帧并进入框选模式 */
  const freezeAndSelect = useCallback(async () => {
    const video = await waitForVideoReady(() => videoRef.current);
    if (!video) {
      setError("画面尚未就绪，请稍候再点一次");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("当前浏览器不支持画布绘制，无法生成截图");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) {
      setError("生成画面失败，请重试");
      return;
    }
    if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
    frameCanvasRef.current = canvas;
    const url = URL.createObjectURL(blob);
    frameUrlRef.current = url;
    setFrameUrl(url);
    setFrameSize({ width: canvas.width, height: canvas.height });
    setSelRect(null);
    selRef.current = null;
    setSelecting(true);
    setError("");
  }, []);

  const beginCapture = useCallback(async () => {
    if (selecting || delayTimerRef.current) return;
    setError("");
    setCopied(false);
    const ok = await ensureStream();
    if (!ok) return;

    if (delay === 0) {
      await freezeAndSelect();
      return;
    }

    if (delayTimerRef.current) clearInterval(delayTimerRef.current);
    let remaining = delay;
    setCountdown(remaining);
    delayTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        return;
      }
      if (delayTimerRef.current) {
        clearInterval(delayTimerRef.current);
        delayTimerRef.current = null;
      }
      setCountdown(0);
      void freezeAndSelect();
    }, 1000);
  }, [delay, ensureStream, freezeAndSelect, selecting]);

  /** 把屏幕坐标换算成冻结帧的像素坐标 */
  const toFramePoint = useCallback((clientX: number, clientY: number) => {
    const el = overlayRef.current;
    const canvas = frameCanvasRef.current;
    if (!el || !canvas) return { x: 0, y: 0 };
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) return { x: 0, y: 0 };
    const x = ((clientX - box.left) / box.width) * canvas.width;
    const y = ((clientY - box.top) / box.height) * canvas.height;
    return {
      x: Math.max(0, Math.min(canvas.width, x)),
      y: Math.max(0, Math.min(canvas.height, y)),
    };
  }, []);

  const commitRect = useCallback(
    async (rect: Rect) => {
      const canvas = frameCanvasRef.current;
      if (!canvas) return;
      const sx = Math.max(0, Math.round(rect.x));
      const sy = Math.max(0, Math.round(rect.y));
      const sw = Math.max(1, Math.min(canvas.width - sx, Math.round(rect.w)));
      const sh = Math.max(1, Math.min(canvas.height - sy, Math.round(rect.h)));

      const out = document.createElement("canvas");
      out.width = sw;
      out.height = sh;
      out.getContext("2d")?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, "image/png")
      );
      if (!blob) {
        setError("生成图片失败，请重试");
        return;
      }

      exitSelection();
      applyBlob(blob, sw, sh);

      if (autoCopy) {
        const ok = await copyBlob(blob);
        if (ok) {
          markCopied();
        } else {
          setError("图片已生成，但浏览器拒绝写入剪贴板，请用下载保存。");
        }
      }
    },
    [applyBlob, autoCopy, copyBlob, exitSelection, markCopied]
  );

  const handleSelectDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = toFramePoint(e.clientX, e.clientY);
    dragStartRef.current = start;
    const rect = { x: start.x, y: start.y, w: 0, h: 0 };
    selRef.current = rect;
    setSelRect(rect);
  };

  const handleSelectMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    const p = toFramePoint(e.clientX, e.clientY);
    const rect = {
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x),
      h: Math.abs(p.y - start.y),
    };
    selRef.current = rect;
    setSelRect(rect);
  };

  const handleSelectUp = () => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    const rect = selRef.current;
    if (!rect || rect.w < MIN_CROP || rect.h < MIN_CROP) {
      selRef.current = null;
      setSelRect(null);
      return;
    }
    void commitRect(rect);
  };

  // 页面内快捷键：Ctrl/⌘ + Shift + X 开始截图，Esc 取消框选
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selecting) {
        event.preventDefault();
        exitSelection();
        return;
      }
      const withModifier = (event.ctrlKey || event.metaKey) && event.shiftKey;
      if (withModifier && (event.key === "x" || event.key === "X")) {
        event.preventDefault();
        void beginCapture();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [beginCapture, exitSelection, selecting]);

  const copyImage = useCallback(async () => {
    if (!shot) return;
    const ok = await copyBlob(shot.blob);
    if (ok) {
      setError("");
      markCopied();
    } else {
      setError("当前浏览器不支持把图片写入剪贴板，请改用下载。");
    }
  }, [copyBlob, markCopied, shot]);

  const clearShot = useCallback(() => {
    if (shotUrlRef.current) URL.revokeObjectURL(shotUrlRef.current);
    shotUrlRef.current = null;
    setShot(null);
    setCropMode(false);
    setCropRect(null);
  }, []);

  /* ---------- 结果图的二次裁剪 ---------- */

  const toShotPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = imageWrapRef.current;
      if (!el || !shot) return { x: 0, y: 0 };
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return { x: 0, y: 0 };
      const x = ((clientX - box.left) / box.width) * shot.width;
      const y = ((clientY - box.top) / box.height) * shot.height;
      return {
        x: Math.max(0, Math.min(shot.width, x)),
        y: Math.max(0, Math.min(shot.height, y)),
      };
    },
    [shot]
  );

  const handleCropDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!cropMode || !shot) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = toShotPoint(e.clientX, e.clientY);
    dragStartRef.current = start;
    setCropRect({ x: start.x, y: start.y, w: 0, h: 0 });
  };

  const handleCropMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    const p = toShotPoint(e.clientX, e.clientY);
    setCropRect({
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x),
      h: Math.abs(p.y - start.y),
    });
  };

  const handleCropUp = () => {
    dragStartRef.current = null;
    setCropRect((prev) =>
      prev && (prev.w < MIN_CROP || prev.h < MIN_CROP) ? null : prev
    );
  };

  const applyCrop = useCallback(async () => {
    if (!shot || !cropRect) return;
    const sx = Math.max(0, Math.round(cropRect.x));
    const sy = Math.max(0, Math.round(cropRect.y));
    const sw = Math.max(1, Math.min(shot.width - sx, Math.round(cropRect.w)));
    const sh = Math.max(1, Math.min(shot.height - sy, Math.round(cropRect.h)));
    try {
      const bitmap = await createImageBitmap(shot.blob);
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext("2d")?.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, shot.blob.type || "image/png")
      );
      if (!blob) {
        setError("裁剪失败，请重试");
        return;
      }
      setError("");
      applyBlob(blob, sw, sh);
    } catch {
      setError("裁剪失败，图片可能已损坏");
    }
  }, [applyBlob, cropRect, shot]);

  const cropReady = !!cropRect && cropRect.w >= MIN_CROP && cropRect.h >= MIN_CROP;

  return (
    <ToolShell>
      <div className="space-y-5">
        {error && <Notice tone="error">{error}</Notice>}

        <Panel icon={Camera} title="框选截图">
          <ol className="text-sm text-slate-600 space-y-1.5 mb-5 leading-relaxed list-decimal pl-5">
            <li>
              按 <span className="font-mono text-slate-800">{HOTKEY_LABEL}</span> 或点下方按钮开始
              （首次会弹出共享授权）。
            </li>
            <li>画面会冻结成一张全屏图，直接拖动框选要保留的区域。</li>
            <li>松开鼠标即完成：只截选中的那部分，默认自动复制到剪贴板。</li>
          </ol>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="ui-label text-sm">延迟进入框选</span>
              <span className="text-xs text-slate-500">截别的窗口时切过去用</span>
            </div>
            <div
              className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl"
              role="radiogroup"
              aria-label="延迟进入框选时间"
            >
              {DELAY_OPTIONS.map((sec) => {
                const active = delay === sec;
                return (
                  <button
                    key={sec}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDelay(sec)}
                    className={`py-1.5 text-sm rounded-lg transition-all ${
                      active
                        ? "bg-white text-indigo-600 font-semibold shadow-sm"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    {sec === 0 ? "立即" : `${sec} 秒后`}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer mb-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={autoCopy}
              onChange={(e) => setAutoCopy(e.target.checked)}
              className="ui-checkbox"
            />
            截取后自动复制到剪贴板
          </label>

          <Button block icon={Camera} onClick={() => void beginCapture()}>
            {stream ? "继续截取区域" : "开始截图"}
            {countdown > 0 ? `（${countdown} 秒后进入框选）` : ""}
          </Button>

          {stream && (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
              <video
                ref={videoRef}
                muted
                autoPlay
                playsInline
                aria-label="正在共享的画面"
                className="w-28 rounded-lg border border-slate-200 bg-slate-900 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700">正在共享，可连续截图</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  再按一次快捷键即可重新框选，无需重复授权。
                </p>
              </div>
              <Button variant="secondary" size="sm" icon={X} onClick={stopShare}>
                停止共享
              </Button>
            </div>
          )}
        </Panel>

        {shot && (
          <Panel icon={ImageIcon} title="截取结果">
            <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 flex items-center justify-center overflow-hidden">
              <div
                ref={imageWrapRef}
                className={`relative inline-block max-w-full ${
                  cropMode ? "cursor-crosshair touch-none select-none" : ""
                }`}
                onPointerDown={handleCropDown}
                onPointerMove={handleCropMove}
                onPointerUp={handleCropUp}
                onPointerCancel={handleCropUp}
              >
                {/* 本地 Blob 预览图，不走 next/image 优化 */}
                <img
                  src={shot.url}
                  alt="截取到的屏幕画面"
                  className="block max-w-full max-h-[60vh] h-auto rounded-lg shadow-sm"
                  draggable={false}
                />
                {cropRect && cropRect.w > 0 && cropRect.h > 0 && (
                  <div
                    className="absolute border-2 border-indigo-500 bg-indigo-500/20 pointer-events-none"
                    style={{
                      left: `${(cropRect.x / shot.width) * 100}%`,
                      top: `${(cropRect.y / shot.height) * 100}%`,
                      width: `${(cropRect.w / shot.width) * 100}%`,
                      height: `${(cropRect.h / shot.height) * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>

            {cropMode && (
              <p className="text-xs text-slate-500 mt-2">
                在图片上按住并拖动，框出要保留的区域
                {cropReady ? "，然后点「应用裁剪」" : ""}。
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-4">
              {cropMode ? (
                <>
                  <Button icon={Check} onClick={() => void applyCrop()} disabled={!cropReady}>
                    应用裁剪
                  </Button>
                  <Button
                    variant="secondary"
                    icon={X}
                    onClick={() => {
                      setCropMode(false);
                      setCropRect(null);
                    }}
                  >
                    取消
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    icon={copied ? Check : Copy}
                    onClick={() => void copyImage()}
                  >
                    {copied ? "已复制" : "复制图片"}
                  </Button>
                  <Button
                    icon={Download}
                    onClick={() => saveBlob(shot.blob, `截图-${fileStamp()}.png`)}
                  >
                    下载 PNG
                  </Button>
                  <Button
                    variant="secondary"
                    icon={CropIcon}
                    onClick={() => {
                      setCropMode(true);
                      setCropRect(null);
                    }}
                  >
                    再裁剪
                  </Button>
                  <Button variant="ghost" icon={RefreshCw} onClick={() => void beginCapture()}>
                    重新截图
                  </Button>
                  <button
                    type="button"
                    onClick={clearShot}
                    className="ui-icon-btn text-red-600 hover:bg-red-50"
                    title="清空结果"
                    aria-label="清空结果"
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              )}
            </div>

            <div className="ui-kv-list mt-4 pt-4 border-t border-slate-100">
              <div className="ui-kv">
                <span className="ui-kv-label">尺寸</span>
                <span className="ui-kv-value font-mono">
                  {shot.width} × {shot.height} px
                </span>
              </div>
              <div className="ui-kv">
                <span className="ui-kv-label">文件大小</span>
                <span className="ui-kv-value font-mono">{formatBytes(shot.blob.size)}</span>
              </div>
            </div>
          </Panel>
        )}

        <Notice tone="info">
          <span className="flex items-center gap-1.5 font-medium text-slate-700 mb-1">
            <Keyboard size={14} />
            关于快捷键
          </span>
          网页只能注册「页面内」快捷键：本页处于焦点时按{" "}
          <span className="font-mono">{HOTKEY_LABEL}</span> 即可截图，框选时按{" "}
          <span className="font-mono">Esc</span> 取消。系统级全局热键（在任何窗口都能触发）需要浏览器扩展才能实现。要截其它程序，请在共享弹窗里直接选那个窗口，或选「整个屏幕」并设 3 秒延迟后切过去。
        </Notice>
      </div>

      {/* 框选遮罩：冻结帧铺满，拖动框选，松开即完成 */}
      {selecting && frameUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4 md:p-8 gap-3"
          role="dialog"
          aria-modal="true"
          aria-label="框选截图区域"
        >
          <div className="flex items-center justify-between w-full max-w-5xl text-sm text-white/80">
            <span>拖动鼠标框选要截取的区域，松开即完成</span>
            <span className="font-mono text-xs text-white/50">
              {selRect && selRect.w >= MIN_CROP && selRect.h >= MIN_CROP
                ? `${Math.round(selRect.w)} × ${Math.round(selRect.h)}`
                : "Esc 取消"}
            </span>
          </div>

          <div
            ref={overlayRef}
            className="relative inline-block overflow-hidden rounded-lg cursor-crosshair touch-none select-none"
            onPointerDown={handleSelectDown}
            onPointerMove={handleSelectMove}
            onPointerUp={handleSelectUp}
            onPointerCancel={handleSelectUp}
          >
            {/* 冻结帧，尺寸由 object-contain 限制在视口内 */}
            <img
              src={frameUrl}
              alt="当前屏幕画面"
              className="block max-h-[calc(100vh-140px)] max-w-[calc(100vw-64px)] object-contain"
              draggable={false}
            />
            {selRect && selRect.w > 0 && selRect.h > 0 && frameSize.width > 0 && (
              <div
                className="absolute border-2 border-indigo-400 pointer-events-none"
                style={{
                  left: `${(selRect.x / frameSize.width) * 100}%`,
                  top: `${(selRect.y / frameSize.height) * 100}%`,
                  width: `${(selRect.w / frameSize.width) * 100}%`,
                  height: `${(selRect.h / frameSize.height) * 100}%`,
                  boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.55)",
                }}
              />
            )}
          </div>

          <Button variant="secondary" size="sm" icon={X} onClick={exitSelection}>
            取消（Esc）
          </Button>
        </div>
      )}
    </ToolShell>
  );
}
