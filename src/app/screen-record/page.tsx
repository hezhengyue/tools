"use client";

// src/app/screen-record/page.tsx
// 在线录屏：浏览器原生 getDisplayMedia 采集屏幕/窗口/标签页，
// MediaRecorder 编码为 WebM，可选混入系统声音与麦克风。全程本地，不上传。

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Mic,
  Pause,
  Play,
  RefreshCw,
  ScreenShare,
  Square,
  Video,
  Volume2,
} from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice, Panel } from "@/components/ui/ToolUI";

type Phase = "idle" | "recording" | "paused" | "done";
type Quality = "standard" | "high";

interface RecordResult {
  url: string;
  blob: Blob;
  size: number;
  mime: string;
  duration: number;
}

const QUALITY_OPTIONS: Array<{ key: Quality; label: string; hint: string }> = [
  { key: "standard", label: "标准", hint: "1080p / 2.5 Mbps，体积更小" },
  { key: "high", label: "高清", hint: "1080p+ / 8 Mbps，画面更清晰" },
];

/** 优先 VP9，其次 VP8，最后退回浏览器默认格式（Safari 走 mp4） */
const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

function fileStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** 把麦克风与系统声音混成一条音轨，视频轨沿用屏幕采集 */
async function mixMicrophone(display: MediaStream) {
  const micStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) {
    micStream.getTracks().forEach((track) => track.stop());
    throw new Error("AudioContext unavailable");
  }
  const ctx = new AudioCtor();
  if (ctx.state === "suspended") await ctx.resume();
  const dest = ctx.createMediaStreamDestination();

  if (display.getAudioTracks().length > 0) {
    ctx.createMediaStreamSource(new MediaStream(display.getAudioTracks())).connect(dest);
  }
  ctx.createMediaStreamSource(micStream).connect(dest);

  return {
    stream: new MediaStream([...display.getVideoTracks(), ...dest.stream.getAudioTracks()]),
    micStream,
    ctx,
  };
}

export default function ScreenRecordPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [systemAudio, setSystemAudio] = useState(true);
  const [micOn, setMicOn] = useState(false);
  const [quality, setQuality] = useState<Quality>("standard");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<RecordResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const pausedTotalRef = useRef(0);
  const durationRef = useRef(0);

  /** 已录制时长（秒），自动扣除暂停时间 */
  const currentElapsed = useCallback(() => {
    if (!startedAtRef.current) return 0;
    const now = Date.now();
    const paused =
      pausedTotalRef.current + (pausedAtRef.current ? now - pausedAtRef.current : 0);
    return Math.max(0, Math.floor((now - startedAtRef.current - paused) / 1000));
  }, []);

  /** 停掉所有采集轨道、音频上下文与计时器 */
  const cleanupStreams = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setStream(null);
  }, []);

  /** 录制结束：把分片拼成可播放的文件 */
  const finalize = useCallback(
    (mimeType: string) => {
      const chunks = chunksRef.current;
      chunksRef.current = [];
      recorderRef.current = null;
      pausedAtRef.current = null;
      pausedTotalRef.current = 0;
      if (chunks.length === 0) {
        cleanupStreams();
        setPhase("idle");
        setError("没有采集到任何数据，请重试");
        return;
      }
      const blob = new Blob(chunks, { type: mimeType || "video/webm" });
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      setResult({
        url,
        blob,
        size: blob.size,
        mime: mimeType || "video/webm",
        duration: durationRef.current,
      });
      setPhase("done");
      cleanupStreams();
    },
    [cleanupStreams]
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    durationRef.current = currentElapsed();
    setElapsed(durationRef.current);
    if (recorder.state !== "inactive") recorder.stop();
  }, [currentElapsed]);

  const startRecording = useCallback(async () => {
    setError("");
    setNotice("");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== "function"
    ) {
      setError(
        "当前浏览器不支持屏幕录制。请使用最新版 Chrome / Edge / Firefox，并在 HTTPS 或 localhost 下打开本页。"
      );
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("当前浏览器不支持 MediaRecorder，无法录制。建议改用 Chrome 或 Edge。");
      return;
    }

    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: quality === "high" ? 60 : 30 },
        audio: systemAudio,
      });
    } catch (err) {
      const e = err as DOMException;
      if (e?.name === "NotAllowedError") {
        setError("你取消了画面选择，或浏览器未授予屏幕录制权限。");
      } else if (e?.name === "NotReadableError") {
        setError("系统拒绝了屏幕采集，可能有其它程序正在占用。");
      } else {
        setError(`无法开始录制：${e?.message || "未知错误"}`);
      }
      return;
    }

    let output = display;
    if (micOn) {
      try {
        const mixed = await mixMicrophone(display);
        output = mixed.stream;
        micStreamRef.current = mixed.micStream;
        audioCtxRef.current = mixed.ctx;
      } catch {
        setNotice(
          "麦克风未授权或不可用，本次只录画面" + (systemAudio ? "与系统声音" : "") + "。"
        );
      }
    }

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(output, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: quality === "high" ? 8_000_000 : 2_500_000,
        audioBitsPerSecond: 128_000,
      });
    } catch {
      display.getTracks().forEach((track) => track.stop());
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioCtxRef.current) void audioCtxRef.current.close().catch(() => {});
      micStreamRef.current = null;
      audioCtxRef.current = null;
      setError("无法初始化录制器，请尝试降低画质或更换浏览器。");
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => finalize(recorder.mimeType);

    recorderRef.current = recorder;
    streamRef.current = output;
    setStream(output);

    // 用户从浏览器工具栏点「停止共享」时自动结束
    display.getVideoTracks()[0]?.addEventListener("ended", () => {
      const current = recorderRef.current;
      if (current && current.state !== "inactive") {
        durationRef.current = currentElapsed();
        setElapsed(durationRef.current);
        current.stop();
      }
    });

    startedAtRef.current = Date.now();
    pausedAtRef.current = null;
    pausedTotalRef.current = 0;
    durationRef.current = 0;
    setElapsed(0);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const seconds = currentElapsed();
      durationRef.current = seconds;
      setElapsed(seconds);
    }, 250);

    recorder.start(1000);
    setPhase("recording");
  }, [currentElapsed, finalize, micOn, quality, systemAudio]);

  const pauseRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    pausedAtRef.current = Date.now();
    setPhase("paused");
  };

  const resumeRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    if (pausedAtRef.current) {
      pausedTotalRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    setPhase("recording");
  };

  const reset = useCallback(() => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    setResult(null);
    setElapsed(0);
    setPhase("idle");
    setError("");
    setNotice("");
  }, []);

  // 预览流挂到 <video>
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {
      // 自动播放被拦截时不影响录制本身
    });
  }, [stream]);

  // 卸载：停止录制与采集，释放 URL。先把 onstop 摘掉，避免卸载后再 setState
  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        if (recorder.state !== "inactive") recorder.stop();
        recorderRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
      if (audioCtxRef.current) void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    },
    []
  );

  const extension = result?.mime.includes("mp4") ? "mp4" : "webm";
  const recording = phase === "recording" || phase === "paused";

  return (
    <ToolShell>
      <div className="space-y-5">
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="info">{notice}</Notice>}

        {phase === "done" && result ? (
          <Panel icon={Video} title="录制完成">
            <video
              controls
              src={result.url}
              aria-label="录制结果预览"
              className="w-full max-h-[60vh] rounded-xl bg-slate-900"
            />

            <div className="ui-kv-list mt-4">
              <div className="ui-kv">
                <span className="ui-kv-label">时长</span>
                <span className="ui-kv-value font-mono">{formatDuration(result.duration)}</span>
              </div>
              <div className="ui-kv">
                <span className="ui-kv-label">文件大小</span>
                <span className="ui-kv-value font-mono">{formatBytes(result.size)}</span>
              </div>
              <div className="ui-kv">
                <span className="ui-kv-label">格式</span>
                <span className="ui-kv-value font-mono break-all">{result.mime}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Button
                icon={Download}
                onClick={() => saveBlob(result.blob, `录屏-${fileStamp()}.${extension}`)}
                className="flex-1 min-w-[160px]"
              >
                下载视频
              </Button>
              <Button variant="secondary" icon={RefreshCw} onClick={reset}>
                重新录制
              </Button>
            </div>
          </Panel>
        ) : (
          <>
            {!recording && (
              <Panel icon={ScreenShare} title="录制设置">
                <div className="space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={systemAudio}
                      onChange={(e) => setSystemAudio(e.target.checked)}
                      className="ui-checkbox mt-1"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <Volume2 size={15} className="text-indigo-600" />
                        录制系统声音
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                        需在浏览器弹窗里同时勾选「分享音频」；共享整个屏幕时 Chrome / Edge 才支持系统声音。
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={micOn}
                      onChange={(e) => setMicOn(e.target.checked)}
                      className="ui-checkbox mt-1"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <Mic size={15} className="text-indigo-600" />
                        混入麦克风（讲解）
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                        开始时会再请求一次麦克风权限，人声与系统声音会混成一条音轨。
                      </span>
                    </span>
                  </label>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="ui-label text-sm">画质</span>
                      <span className="text-xs text-slate-500">
                        {QUALITY_OPTIONS.find((item) => item.key === quality)?.hint}
                      </span>
                    </div>
                    <div
                      className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl"
                      role="radiogroup"
                      aria-label="录制画质"
                    >
                      {QUALITY_OPTIONS.map((item) => {
                        const active = quality === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setQuality(item.key)}
                            className={`py-1.5 text-sm rounded-lg transition-all ${
                              active
                                ? "bg-white text-indigo-600 font-semibold shadow-sm"
                                : "text-slate-600 hover:text-slate-800"
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <Button block icon={Video} onClick={() => void startRecording()} className="mt-5">
                  开始录制
                </Button>
              </Panel>
            )}

            {recording && (
              <Panel
                icon={ScreenShare}
                title={phase === "recording" ? "正在录制" : "已暂停"}
              >
                <div className="rounded-xl overflow-hidden bg-slate-900">
                  <video
                    ref={videoRef}
                    muted
                    autoPlay
                    playsInline
                    aria-label="录制画面预览"
                    className="w-full max-h-[55vh] object-contain bg-slate-900"
                  />
                </div>

                <div className="flex items-center justify-between mt-4">
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        phase === "recording" ? "bg-red-500 animate-pulse" : "bg-amber-500"
                      }`}
                    />
                    {phase === "recording" ? "录制中" : "已暂停"}
                  </span>
                  <span className="font-mono text-xl font-semibold text-slate-800 tabular-nums">
                    {formatDuration(elapsed)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {phase === "recording" ? (
                    <Button variant="secondary" icon={Pause} onClick={pauseRecording}>
                      暂停
                    </Button>
                  ) : (
                    <Button variant="secondary" icon={Play} onClick={resumeRecording}>
                      继续
                    </Button>
                  )}
                  <Button icon={Square} onClick={stopRecording} className="flex-1 min-w-[160px]">
                    停止并生成视频
                  </Button>
                </div>
              </Panel>
            )}
          </>
        )}

        <Notice tone="tip">
          录制权限由浏览器弹窗授予，可选「整个屏幕 / 窗口 / 标签页」。停止时若视频还没生成完，稍等一下即可。WebM 可直接上传到视频网站，需要 MP4 时用剪辑软件转码即可。
        </Notice>
      </div>
    </ToolShell>
  );
}
