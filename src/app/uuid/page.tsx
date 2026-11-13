// app/uuid/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Braces, Fingerprint, History, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Badge, Button, Notice, OutputBlock, Segmented, Switch } from "@/components/ui/ToolUI";

type IdKind = "v4" | "v7" | "nanoid" | "custom";

const NANOID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
const DEFAULT_CUSTOM_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const HISTORY_KEY = "tools.uuid.history";

const KIND_DESC: Record<IdKind, string> = {
  v4: "完全随机，最通用；122 位随机性，适合数据库主键、API Key。",
  v7: "前 48 位是毫秒时间戳，按时间大致有序，对索引更友好。",
  nanoid: "URL 安全的短随机 ID，同样长度下比 UUID 紧凑。",
  custom: "自定义字符集与长度，可生成邀请码、订单号、短链接后缀。",
};

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function formatUuid(bytes: Uint8Array, upper: boolean, hyphens: boolean) {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const value = hyphens
    ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    : hex;
  return upper ? value.toUpperCase() : value;
}

function uuidV4() {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes;
}

function uuidV7() {
  const bytes = randomBytes(16);
  // 不用 BigInt（项目 target 为 ES2017），按字节写入 48 位毫秒时间戳
  let time = Date.now();
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = time % 256;
    time = Math.floor(time / 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes;
}

/** 去重并限制到 256 个字符，保证拒绝采样的分母有效 */
function cleanAlphabet(raw: string) {
  return Array.from(new Set(Array.from(raw))).slice(0, 256).join("");
}

/** 拒绝采样：丢掉 >= floor(256/n)*n 的字节，避免取模造成字符概率偏差 */
function randomFromAlphabet(alphabet: string, length: number): string {
  if (!alphabet || length <= 0) return "";
  const limit = Math.floor(256 / alphabet.length) * alphabet.length;
  let output = "";
  while (output.length < length) {
    const bytes = randomBytes(Math.max(16, length - output.length));
    for (const byte of bytes) {
      if (byte >= limit) continue;
      output += alphabet[byte % alphabet.length];
      if (output.length >= length) break;
    }
  }
  return output;
}

export default function UuidPage() {
  const [kind, setKind] = useState<IdKind>("v4");
  const [count, setCount] = useState(10);
  const [uppercase, setUppercase] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [prefix, setPrefix] = useState("");
  const [customAlphabet, setCustomAlphabet] = useState(DEFAULT_CUSTOM_ALPHABET);
  const [customLength, setCustomLength] = useState(16);
  const [values, setValues] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(HISTORY_KEY);
        if (!raw) return;
        const saved: unknown = JSON.parse(raw);
        if (Array.isArray(saved) && saved.every((item) => typeof item === "string")) {
          setHistory(saved.slice(0, 5));
        }
      } catch {
        // 本地存储不可用时忽略，不影响生成
      }
    });
  }, []);

  const alphabet = kind === "nanoid" ? NANOID_ALPHABET : cleanAlphabet(customAlphabet);
  const length = kind === "nanoid" ? 21 : Math.max(1, Math.min(256, customLength || 1));
  const entropy = useMemo(() => {
    if (kind === "v4") return 122;
    if (kind === "v7") return 74;
    return Math.round(length * Math.log2(Math.max(1, alphabet.length)) * 10) / 10;
  }, [kind, length, alphabet]);

  const output = values.map((value) => `${prefix}${value}`).join("\n");
  const uniqueCount = new Set(values).size;

  const generate = () => {
    const safeCount = Math.max(1, Math.min(100, Number(count) || 1));
    const generated: string[] = [];
    for (let index = 0; index < safeCount; index += 1) {
      if (kind === "v4") generated.push(formatUuid(uuidV4(), uppercase, hyphens));
      else if (kind === "v7") generated.push(formatUuid(uuidV7(), uppercase, hyphens));
      else generated.push(randomFromAlphabet(alphabet, length));
    }
    setValues(generated);
    setNotice("");

    const next = [generated.join("\n"), ...history].slice(0, 5);
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // 隐私模式下写入失败不影响本页功能
    }
  };

  const clear = () => {
    setValues([]);
    setNotice("");
  };

  return (
    <ToolShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <span className="ui-label text-sm flex items-center gap-2">
            <Fingerprint size={16} className="text-indigo-600" /> ID 类型
          </span>
          <Segmented<IdKind>
            label="ID 类型"
            value={kind}
            onChange={setKind}
            options={[
              { value: "v4", label: "UUID v4" },
              { value: "v7", label: "UUID v7" },
              { value: "nanoid", label: "NanoID" },
              { value: "custom", label: "自定义" },
            ]}
          />
          <p className="text-xs text-slate-500">{KIND_DESC[kind]}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="uuid-count" className="ui-label text-sm">生成数量（1–100）</label>
            <input
              id="uuid-count"
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              className="ui-input"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="uuid-prefix" className="ui-label text-sm">前缀（选填）</label>
            <input
              id="uuid-prefix"
              value={prefix}
              onChange={(event) => setPrefix(event.target.value)}
              placeholder="例如 usr_"
              className="ui-input font-mono text-sm"
            />
          </div>
        </div>

        {(kind === "v4" || kind === "v7") && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Switch id="uuid-upper" checked={uppercase} onChange={setUppercase} label="大写" />
            <Switch id="uuid-hyphen" checked={hyphens} onChange={setHyphens} label="保留连字符" />
          </div>
        )}

        {kind === "custom" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="uuid-alphabet" className="ui-label text-sm">字符集</label>
              <input
                id="uuid-alphabet"
                value={customAlphabet}
                onChange={(event) => setCustomAlphabet(event.target.value)}
                spellCheck={false}
                className="ui-input font-mono text-sm"
              />
              <p className="text-xs text-slate-500">重复字符会自动去重，最多取前 256 个；当前 {alphabet.length} 个。</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="uuid-length" className="ui-label text-sm">长度：{length}</label>
              <input
                id="uuid-length"
                type="range"
                min={4}
                max={128}
                value={length}
                onChange={(event) => setCustomLength(Number(event.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button icon={RefreshCw} onClick={generate}>生成 ID</Button>
          <Button variant="ghost" icon={Trash2} onClick={clear} disabled={!values.length}>清空结果</Button>
          <Badge className="bg-indigo-50 text-indigo-700"><ShieldCheck size={13} className="inline mr-1" />{entropy} bit 随机性</Badge>
        </div>

        {notice && <Notice tone="info">{notice}</Notice>}

        <OutputBlock
          label="生成结果"
          hint={`${values.length} 条 · 去重后 ${uniqueCount} 条${prefix ? ` · 前缀 ${prefix}` : ""}`}
          value={output}
          copyLabel="复制全部 ID"
          filename="ids.txt"
          placeholder="点击「生成 ID」后，结果会一行一条显示在这里…"
          minHeight="min-h-[220px]"
          textareaClassName="text-xs"
        />

        {values.length > 1 && uniqueCount !== values.length && (
          <Notice tone="error">检测到重复 ID（{values.length - uniqueCount} 个），请重新生成。通常意味着字符集过短或长度过小。</Notice>
        )}

        {history.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between gap-3">
              <span className="ui-label text-sm flex items-center gap-2">
                <History size={16} className="text-indigo-600" /> 最近生成（仅存本机）
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                onClick={() => {
                  setHistory([]);
                  try { localStorage.removeItem(HISTORY_KEY); } catch { /* 忽略 */ }
                }}
              >清空记录</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((batch, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => { setValues(batch.split("\n")); setNotice("已载入这批 ID，可直接复制"); }}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                  第 {index + 1} 批 · {batch.split("\n").length} 条
                </button>
              ))}
            </div>
          </div>
        )}

        <Notice tone="tip">
          <Braces size={14} className="inline mr-1" />
          随机源是浏览器的 <code className="font-mono">crypto.getRandomValues</code>（密码学安全），不是 <code className="font-mono">Math.random</code>；自定义 ID 用拒绝采样避免字符概率偏差。
        </Notice>
      </div>
    </ToolShell>
  );
}
