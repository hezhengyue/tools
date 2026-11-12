// app/hash-text/page.tsx
"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
// 按需引入子模块：避免 crypto-js 主入口把 30+ 种算法一次性打进首屏 bundle
import MD5 from "crypto-js/md5";
import RIPEMD160 from "crypto-js/ripemd160";
import SHA1 from "crypto-js/sha1";
import SHA224 from "crypto-js/sha224";
import SHA256 from "crypto-js/sha256";
import SHA3 from "crypto-js/sha3";
import SHA384 from "crypto-js/sha384";
import SHA512 from "crypto-js/sha512";
import Hex from "crypto-js/enc-hex";
import Base64 from "crypto-js/enc-base64";
import ToolShell from "@/components/ToolShell";
import { Notice, CopyButton } from "@/components/ui/ToolUI";

// ============ 类型定义 ============

type HashAlgorithm = "MD5" | "SHA1" | "SHA256" | "SHA224" | "SHA512" | "SHA384" | "SHA3" | "RIPEMD160";
type Encoding = "Hex" | "Base64" | "Base64url" | "Bin";
type WordArray = CryptoJS.lib.WordArray;

const ALGORITHMS: { label: string; value: HashAlgorithm; color: string }[] = [
  { label: "MD5", value: "MD5", color: "indigo" },
  { label: "SHA1", value: "SHA1", color: "blue" },
  { label: "SHA224", value: "SHA224", color: "cyan" },
  { label: "SHA256", value: "SHA256", color: "emerald" },
  { label: "SHA384", value: "SHA384", color: "teal" },
  { label: "SHA512", value: "SHA512", color: "violet" },
  { label: "SHA3", value: "SHA3", color: "purple" },
  { label: "RIPEMD160", value: "RIPEMD160", color: "pink" },
];

const ENCODINGS: { label: string; value: Encoding }[] = [
  { label: "Hexadecimal (base 16)", value: "Hex" },
  { label: "Base64 (base 64)", value: "Base64" },
  { label: "Base64url (URL safe)", value: "Base64url" },
  { label: "Binary (base 2)", value: "Bin" },
];

// ============ 工具函数 ============

function convertHexToBin(hex: string): string {
  return hex.trim().split("").map((byte) => parseInt(byte, 16).toString(2).padStart(4, "0")).join("");
}

function formatWithEncoding(wordArray: WordArray, encoding: Encoding): string {
  switch (encoding) {
    case "Bin": return convertHexToBin(wordArray.toString(Hex));
    case "Base64url": return wordArray.toString(Base64).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    case "Base64": return wordArray.toString(Base64);
    default: return wordArray.toString(Hex);
  }
}

function hashText(algorithm: HashAlgorithm, text: string, encoding: Encoding = "Hex"): string {
  const algorithms: Record<HashAlgorithm, (text: string) => WordArray> = {
    MD5, SHA1, SHA256, SHA224, SHA512, SHA384, SHA3, RIPEMD160,
  };
  return formatWithEncoding(algorithms[algorithm](text), encoding);
}

// ============ 核心功能组件 ============

function HashTextCore() {
  const [inputText, setInputText] = useState("");
  // 防抖后的文本：连续输入时不再每敲一个字符就同步算 8 种哈希
  const [debouncedText, setDebouncedText] = useState("");
  const [encoding, setEncoding] = useState<Encoding>("Hex");
  const [isGenerating, setIsGenerating] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedText(inputText), 250);
    return () => clearTimeout(timer);
  }, [inputText]);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const hashes = useMemo(() => {
    return ALGORITHMS.reduce((acc, { value }) => {
      acc[value] = debouncedText ? hashText(value, debouncedText, encoding) : "";
      return acc;
    }, {} as Record<HashAlgorithm, string>);
  }, [debouncedText, encoding]);

  const handleRegenerate = () => {
    setIsGenerating(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setIsGenerating(false), 300);
  };

  const handleClear = () => {
    setInputText("");
    setDebouncedText("");
  };

  return (
    <>
      {/* 输入区域 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <label htmlFor="hash-input" className="font-semibold text-slate-700">哈希文本</label>
          {inputText && (
            <button onClick={handleClear} className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">
              清空
            </button>
          )}
        </div>
        <textarea
          id="hash-input"
          value={inputText}
          onChange={(e) => { setInputText(e.target.value); handleRegenerate(); }}
          placeholder="输入任意文本进行哈希计算..."
          className="ui-textarea min-h-[120px]"
          autoFocus
        />
        <div className="text-right text-xs text-slate-500 mt-2">{inputText.length} 个字符</div>
      </div>

      {/* 编码选择 */}
      <div className="mb-6">
        <span className="font-semibold text-slate-700 block mb-3">输出编码格式</span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ENCODINGS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setEncoding(opt.value); handleRegenerate(); }}
              aria-pressed={encoding === opt.value}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                encoding === opt.value
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 哈希结果列表 */}
      <div className="space-y-3">
        {ALGORITHMS.map(({ label, value, color }) => {
          const hashValue = hashes[value] || "";
          const colorClasses: Record<string, string> = {
            indigo: "text-indigo-600 bg-indigo-50 border-indigo-200",
            blue: "text-blue-600 bg-blue-50 border-blue-200",
            cyan: "text-cyan-600 bg-cyan-50 border-cyan-200",
            emerald: "text-emerald-600 bg-emerald-50 border-emerald-200",
            teal: "text-teal-600 bg-teal-50 border-teal-200",
            violet: "text-violet-600 bg-violet-50 border-violet-200",
            purple: "text-purple-600 bg-purple-50 border-purple-200",
            pink: "text-pink-600 bg-pink-50 border-pink-200",
          };

          return (
            <div
              key={value}
              className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                hashValue ? colorClasses[color] : "bg-slate-50 border-slate-200 text-slate-500"
              } ${isGenerating ? "animate-pulse" : ""}`}
            >
              <span className="font-mono font-bold w-24 text-sm shrink-0">{label}</span>
              <input
                readOnly
                value={hashValue || "—"}
                aria-label={`${label} 哈希值`}
                className="flex-1 bg-transparent border-0 font-mono text-sm truncate focus:outline-none"
                placeholder="等待输入..."
              />
              <CopyButton value={hashValue} label={`复制 ${label} 哈希值`} />
            </div>
          );
        })}
      </div>

      {/* 空状态提示 */}
      {!inputText && (
        <Notice tone="tip" className="mt-6">
          在上方输入文本，即可实时生成各种哈希值。所有计算均在本地完成，数据不会上传。
        </Notice>
      )}

      {/* 重新生成按钮 */}
      <button
        onClick={handleRegenerate}
        disabled={!inputText}
        className="ui-btn ui-btn-primary ui-btn-block mt-6"
      >
        <RefreshCw size={18} className={`mr-2 ${isGenerating ? "animate-spin" : ""}`} />
        重新计算哈希
      </button>
    </>
  );
}

// ============ 页面导出（用 ToolShell 包裹） ============

export default function HashTextPage() {
  return (
    <ToolShell>
      <HashTextCore />
    </ToolShell>
  );
}
