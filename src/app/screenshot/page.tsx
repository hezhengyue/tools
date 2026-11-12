"use client";

// src/app/screenshot/page.tsx
// 在线截图：用浏览器原生 getDisplayMedia 捕获屏幕/窗口/标签页，取帧画到 canvas，
// 再支持裁剪、复制到剪贴板与导出 PNG。全程本地处理，不上传任何数据。

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Camera,
  Check,
  Copy,
  Crop as CropIcon,
  Download,
  Image as ImageIcon,
  MonitorPlay,
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

/** 裁剪碎片小于该尺寸视为误触，直接丢弃 */
const MIN_CROP = 8;

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

export default function ScreenshotPage() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const [delay, setDelay] = useState<number>(0);
  const [countdown, setCountdown] = useState(0);
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageWrapRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shotUrlRef = useRef<string | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  /** 用新的 Blob 替换当前结果，并释放上一张的 ObjectURL */
  const applyBlob = useCallback((blob: Blob, width: number, height: number) => {
    if (shotUrlRef.current) URL.revokeObjectURL(shotUrlRef.current);
    const url = URL.createObjectURL(blob);
    shotUrlRef.current = url;
    setShot({ url, blob, width, height });
    setCropRect(null);
    setCropMode(false);
  }, []);

  /** 停止共享并清空预览（结果图保留） */
  const stopShare = useCallback(() => {
    if (delayTimerRef.current) {
      clearInterval(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setCountdown(0);
  }, []);

  // 卸载：停掉采集、定时器与结果图 URL，避免离开页面后仍在占用屏幕
  useEffect(
    () => () => {
      if (delayTimerRef.current) clearInterval(delayTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (shotUrlRef.current) URL.revokeObjectURL(shotUrlRef.current);
      shotUrlRef.current = null;
    },
    []
  );

  // 把实时流接到 <video> 上（只在拿到流之后渲染该元素）
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {
      // 自动播放被拦截时用户可手动点播放，不影响取帧
    });
  }, [stream]);

  // 支持直接粘贴剪贴板里的图片，方便对已有截图做裁剪
  useEffect(() => {
    const onPaste = async (event: ClipboardEvent) => {
      const items = Array.from(event.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      event.preventDefault();
      try {
        const bitmap = await createImageBitmap(file);
        const { width, height } = bitmap;
        bitmap.close();
        setError("");
        applyBlob(file, width, height);
      } catch {
        setError("粘贴的图片无法读取，请换一张试试");
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [applyBlob]);

  const captureNow = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("画面尚未就绪，请稍等片刻再点一次");
      return;
    }
    const width = video.videoWidth;
    const height = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("当前浏览器不支持画布绘制，无法生成截图");
      return;
    }
    ctx.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) {
      setError("生成图片失败，请重试");
      return;
    }
    setError("");
    applyBlob(blob, width, height);
  }, [applyBlob]);

  const startShare = useCallback(async () => {
    setError("");
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== "function"
    ) {
      setError(
        "当前浏览器不支持屏幕捕获。请使用最新版 Chrome / Edge / Firefox，并在 HTTPS 或 localhost 下打开本页。"
      );
      return;
    }
    try {
      const next = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      streamRef.current = next;
      setStream(next);
      // 用户从浏览器工具栏点「停止共享」时自动收尾
      next.getVideoTracks()[0]?.addEventListener("ended", stopShare);
    } catch (err) {
      const e = err as DOMException;
      if (e?.name === "NotAllowedError") {
        setError("你取消了画面选择，或浏览器未授予屏幕捕获权限。");
      } else if (e?.name === "NotReadableError") {
        setError("系统拒绝了屏幕捕获请求，可能有其它程序正在录制屏幕。");
      } else {
        setError(`无法开始屏幕捕获：${e?.message || "未知错误"}`);
      }
    }
  }, [stopShare]);

  const takeShot = useCallback(() => {
    if (delay === 0) {
      void captureNow();
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
      void captureNow();
    }, 1000);
  }, [captureNow, delay]);

  const copyImage = useCallback(async () => {
    if (!shot) return;
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("unsupported");
      }
      await navigator.clipboard.write([
        new ClipboardItem({ [shot.blob.type || "image/png"]: shot.blob }),
      ]);
      setError("");
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("当前浏览器不支持把图片写入剪贴板，请改用下载。");
    }
  }, [shot]);

  const clearShot = useCallback(() => {
    if (shotUrlRef.current) URL.revokeObjectURL(shotUrlRef.current);
    shotUrlRef.current = null;
    setShot(null);
    setCropMode(false);
    setCropRect(null);
  }, []);

  /** 把鼠标坐标换算成图片原始像素坐标 */
  const toNaturalPoint = useCallback(
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

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!cropMode || !shot) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = toNaturalPoint(e.clientX, e.clientY);
    dragStartRef.current = start;
    setCropRect({ x: start.x, y: start.y, w: 0, h: 0 });
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    const p = toNaturalPoint(e.clientX, e.clientY);
    setCropRect({
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x),
      h: Math.abs(p.y - start.y),
    });
  };

  const handlePointerUp = () => {
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

        {/* 未开始：说明 + 延迟设置 */}
        {!stream && !shot && (
          <Panel icon={Camera} title="开始截屏">
            <ol className="text-sm text-slate-600 space-y-2 mb-5 leading-relaxed list-decimal pl-5">
              <li>点击下方按钮，在浏览器弹窗里选择要截取的「整个屏幕 / 窗口 / 标签页」。</li>
              <li>看到实时画面后点击「截取当前画面」，即可得到这一帧。</li>
              <li>截取后可以拖动裁剪、复制到剪贴板或下载为 PNG。</li>
            </ol>

            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="ui-label text-sm">延迟截取</span>
                <span className="text-xs text-slate-500">
                  给菜单、悬浮框留出操作时间
                </span>
              </div>
              <div
                className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl"
                role="radiogroup"
                aria-label="延迟截取时间"
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

            <Button block icon={MonitorPlay} onClick={() => void startShare()}>
              选择要截取的画面
            </Button>
          </Panel>
        )}

        {/* 实时预览 */}
        {stream && (
          <Panel
            icon={MonitorPlay}
            title="实时预览"
            className="relative"
          >
            <div className="relative rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center">
              <video
                ref={videoRef}
                muted
                autoPlay
                playsInline
                aria-label="屏幕实时预览"
                className="w-full max-h-[60vh] object-contain bg-slate-900"
              />
              {countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
                  <span className="text-white text-6xl font-extrabold tabular-nums drop-shadow-lg">
                    {countdown}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Button
                icon={Camera}
                onClick={takeShot}
                disabled={countdown > 0}
                className="flex-1 min-w-[160px]"
              >
                {delay > 0 ? `${delay} 秒后截取` : "截取当前画面"}
              </Button>
              <Button variant="secondary" icon={X} onClick={stopShare}>
                停止共享
              </Button>
            </div>
          </Panel>
        )}

        {/* 截取结果 */}
        {shot && (
          <Panel icon={ImageIcon} title="截取结果">
            <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 flex items-center justify-center overflow-hidden">
              <div
                ref={imageWrapRef}
                className={`relative inline-block max-w-full ${
                  cropMode ? "cursor-crosshair touch-none select-none" : ""
                }`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
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
                在图片上按住并拖动，框出要保留的区域{cropReady ? "，然后点「应用裁剪」" : ""}。
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
                    icon={CropIcon}
                    onClick={() => {
                      setCropMode(true);
                      setCropRect(null);
                    }}
                  >
                    裁剪
                  </Button>
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
                    variant="ghost"
                    icon={RefreshCw}
                    onClick={() => (stream ? takeShot() : void startShare())}
                  >
                    重新截取
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

        <Notice tone="tip">
          也可以直接按 <span className="font-mono">Ctrl/Cmd + V</span> 粘贴一张已有截图，同样能做裁剪和导出。截屏需要浏览器授权，页面本身不保存任何画面。
        </Notice>
      </div>
    </ToolShell>
  );
}
