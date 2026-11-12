"use client";

// src/app/base64/page.tsx
// Base64 编解码：文本（UTF-8 安全）/ 文件双模式，支持 URL-safe、Data URL 前缀与 MIME 换行。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { ArrowLeftRight, Binary, FileUp, Info, X } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Notice, OutputBlock } from "@/components/ui/ToolUI";

/* ============================ 编解码 ============================ */

/** Uint8Array → base64（分块，避免大文件时栈溢出） */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}

/** base64 → Uint8Array：容忍换行、URL-safe 字符与缺失的 padding */
function base64ToBytes(input: string): Uint8Array {
  const cleaned = input
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = cleaned + "=".repeat((4 - (cleaned.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toUrlSafe(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 每 76 字符换行（MIME 规范），解码时会被自动忽略 */
function wrap76(base64: string): string {
  return base64.replace(/(.{76})/g, "$1\n").trim();
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;

interface PickedFile {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

/* ============================ 页面 ============================ */

function Base64Core() {
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [source, setSource] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [encoded, setEncoded] = useState("");
  const [urlSafe, setUrlSafe] = useState(false);
  const [withPrefix, setWithPrefix] = useState(false);
  const [mimeWrap, setMimeWrap] = useState(false);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [decoded, setDecoded] = useState("");
  const [decodeError, setDecodeError] = useState("");
  const [lossy, setLossy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ---------- 文本编码 ---------- */
  const textOutput = useMemo(() => {
    if (!text) return "";
    let result = bytesToBase64(new TextEncoder().encode(text));
    if (urlSafe) result = toUrlSafe(result);
    else if (mimeWrap) result = wrap76(result);
    return result;
  }, [mimeWrap, text, urlSafe]);

  /* ---------- 文件编码 ---------- */
  const fileOutput = useMemo(() => {
    if (!file) return "";
    const base64 = file.dataUrl.slice(file.dataUrl.indexOf(",") + 1);
    let result = withPrefix
      ? urlSafe
        ? `data:${file.type || "application/octet-stream"};base64,${toUrlSafe(base64)}`
        : file.dataUrl
      : base64;
    if (!withPrefix && urlSafe) result = toUrlSafe(result);
    if (mimeWrap) result = wrap76(result);
    return result;
  }, [file, mimeWrap, urlSafe, withPrefix]);

  /* ---------- 解码 ---------- */
  useEffect(() => {
    const input = encoded.trim();
    if (!input) return;
    const timer = setTimeout(() => {
      try {
        const bytes = base64ToBytes(input);
        if (!bytes.length) {
          setDecoded("");
          setDecodeError("没有解码出任何内容");
          return;
        }
        try {
          setDecoded(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
          setLossy(false);
          setDecodeError("");
        } catch {
          // 不是合法 UTF-8：可能是二进制文件，降级展示并提示
          setDecoded(new TextDecoder("utf-8").decode(bytes));
          setLossy(true);
          setDecodeError("");
        }
      } catch {
        setDecoded("");
        setLossy(false);
        setDecodeError("不是合法的 Base64：请检查是否含有非法字符，或去掉多余的 data: 前缀。");
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [encoded]);

  const pickFile = useCallback((next: File | null | undefined) => {
    if (!next) return;
    if (next.size > MAX_FILE_BYTES) {
      setFileError(`文件 ${formatBytes(next.size)}，超过 ${formatBytes(MAX_FILE_BYTES)} 上限。`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl.includes(",")) {
        setFileError("读取文件失败，请换一个文件试试。");
        return;
      }
      setFileError("");
      setFile({ name: next.name, size: next.size, type: next.type, dataUrl });
    };
    reader.onerror = () => setFileError("读取文件失败，请重试。");
    reader.readAsDataURL(next);
  }, []);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  const switchMode = (next: "encode" | "decode") => {
    // 切换方向时把上一次的结果带过去，省得重新粘贴
    if (next === "decode" && mode === "encode") {
      const current = source === "text" ? textOutput : fileOutput;
      if (current) setEncoded(current);
    }
    if (next === "encode" && mode === "decode" && decoded) setText(decoded);
    setMode(next);
  };

  const output = source === "text" ? textOutput : fileOutput;
  const originalBytes = source === "text" ? new TextEncoder().encode(text).length : file?.size ?? 0;
  const encodedBytes = output.length;

  return (
    <div className="space-y-5">
      {/* 方向 + 输入类型 */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex p-1 bg-slate-100 rounded-xl"
          role="tablist"
          aria-label="编解码方向"
        >
          {([
            { value: "encode" as const, label: "编码", icon: Binary },
            { value: "decode" as const, label: "解码", icon: ArrowLeftRight },
          ]).map(({ value, label, icon: Icon }) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchMode(value)}
                className={`flex items-center justify-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-all ${
                  active
                    ? "bg-white text-indigo-600 font-semibold shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </div>

        {mode === "encode" && (
          <div
            className="inline-flex p-1 bg-slate-100 rounded-xl"
            role="tablist"
            aria-label="输入类型"
          >
            {[
              { value: "text" as const, label: "文本" },
              { value: "file" as const, label: "文件" },
            ].map(({ value, label }) => {
              const active = source === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSource(value)}
                  className={`px-4 py-1.5 text-sm rounded-lg transition-all ${
                    active
                      ? "bg-white text-indigo-600 font-semibold shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {mode === "encode" ? (
        <>

          {source === "text" ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="b64-text" className="ui-label text-sm">
                  原始文本
                </label>
                <span className="text-xs text-slate-500">
                  {text.length} 字符 · {formatBytes(originalBytes)}
                </span>
              </div>
              <textarea
                id="b64-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="支持中文与 emoji，按 UTF-8 编码后转 Base64"
                spellCheck={false}
                autoComplete="off"
                className="ui-textarea min-h-[180px] font-mono"
              />
            </div>
          ) : (
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  dragging
                    ? "border-indigo-400 bg-indigo-50/60"
                    : "border-slate-200 bg-slate-50/60"
                }`}
              >
                <FileUp size={22} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-600">
                  把文件拖到这里，或
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-indigo-600 font-medium hover:underline mx-1"
                  >
                    选择文件
                  </button>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  上限 {formatBytes(MAX_FILE_BYTES)}，文件不会离开你的浏览器
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    pickFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>

              {fileError && (
                <Notice tone="error" className="mt-3">
                  {fileError}
                </Notice>
              )}

              {file && (
                <div className="flex items-center gap-3 mt-3 p-3 rounded-xl border border-slate-200 bg-white">
                  {file.type.startsWith("image/") && (
                    // 本地 FileReader 读出的 data URL 预览，不走 next/image
                    <img
                      src={file.dataUrl}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatBytes(file.size)} · {file.type || "未知类型"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="ui-icon-btn text-red-600 hover:bg-red-50"
                    title="移除文件"
                    aria-label="移除文件"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 编码选项 */}
          <div className="space-y-2">
            {source === "file" && (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={withPrefix}
                  onChange={(e) => setWithPrefix(e.target.checked)}
                  className="ui-checkbox"
                />
                保留 Data URL 前缀
                <span className="text-xs text-slate-500">（可直接写进 img 的 src）</span>
              </label>
            )}
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                checked={urlSafe}
                onChange={(e) => setUrlSafe(e.target.checked)}
                className="ui-checkbox"
              />
              URL-safe 变体
              <span className="text-xs text-slate-500">
                （<span className="font-mono">+ /</span> 换成 <span className="font-mono">- _</span>
                ，去掉结尾的 <span className="font-mono">=</span>）
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                checked={mimeWrap}
                onChange={(e) => setMimeWrap(e.target.checked)}
                className="ui-checkbox"
                disabled={urlSafe}
              />
              每 76 字符换行
              <span className="text-xs text-slate-500">
                （MIME 规范；与 URL-safe 互斥）
              </span>
            </label>
          </div>

          <OutputBlock
            label="Base64"
            hint={
              output
                ? `${encodedBytes.toLocaleString()} 字符 · 比原始数据约多 ${originalBytes ? Math.max(0, Math.round((encodedBytes / originalBytes - 1) * 100)) : 0}%`
                : undefined
            }
            value={output}
            filename={`${source === "file" && file ? file.name : "text"}.base64.txt`}
            placeholder="编码结果会显示在这里"
            minHeight="min-h-[180px]"
            textareaClassName="font-mono"
          />

          {!output && (
            <Notice tone="tip">
              输入文本或选择文件后自动编码，结果可以直接复制或下载。中文、emoji 都按 UTF-8 字节处理，不会乱码。
            </Notice>
          )}
        </>
      ) : (
        <>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="b64-source" className="ui-label text-sm">
                Base64 内容
              </label>
              <span className="text-xs text-slate-500">{encoded.trim().length} 字符</span>
            </div>
            <textarea
              id="b64-source"
              value={encoded}
              onChange={(e) => setEncoded(e.target.value)}
              placeholder="粘贴 Base64 字符串，可带 data:image/png;base64, 前缀"
              spellCheck={false}
              autoComplete="off"
              className="ui-textarea min-h-[180px] font-mono"
            />
          </div>

          {decodeError && <Notice tone="error">{decodeError}</Notice>}

          {lossy && (
            <Notice tone="info">
              这一段不是合法的 UTF-8 文本，已按容错方式显示。原始数据可能是二进制文件（图片、压缩包等），建议直接保存为文件再用对应工具打开。
            </Notice>
          )}

          <OutputBlock
            label="解码结果"
            hint={decoded ? `${new TextEncoder().encode(decoded).length} 字节` : undefined}
            value={decoded}
            filename="decoded.txt"
            placeholder="解码后的文本会显示在这里"
            minHeight="min-h-[180px]"
          />

          {!encoded.trim() && (
            <Notice tone="tip">
              粘贴 Base64 后自动解码。换行、空格、缺失的 <span className="font-mono">=</span>
              会被自动忽略，<span className="font-mono">-_</span> 也能正确识别。
            </Notice>
          )}
        </>
      )}

      <div className="flex items-center gap-2 pt-4 border-t border-slate-100 text-xs text-slate-500">
        <Info size={14} className="shrink-0" />
        <p className="leading-relaxed">
          中文、emoji 都按 UTF-8 字节编码，不会出现乱码；<span className="font-mono">atob</span> 直接处理
          Unicode 字符串是常见的乱码原因。
        </p>
      </div>
    </div>
  );
}

export default function Base64Page() {
  return (
    <ToolShell>
      <Base64Core />
    </ToolShell>
  );
}
