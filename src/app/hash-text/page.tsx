// app/hash-text/page.tsx
"use client";

import { useState, useMemo } from "react";
import { Copy, Check, RefreshCw } from "lucide-react";
import { MD5, RIPEMD160, SHA1, SHA224, SHA256, SHA3, SHA384, SHA512, enc } from "crypto-js";
import ToolShell from "@/components/ToolShell";

// ============ 类型定义 ============

type HashAlgorithm = "MD5" | "SHA1" | "SHA256" | "SHA224" | "SHA512" | "SHA384" | "SHA3" | "RIPEMD160";
type Encoding = "Hex" | "Base64" | "Base64url" | "Bin";

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

const ENCodings: { label: string; value: Encoding }[] = [
  { label: "Hexadecimal (base 16)", value: "Hex" },
  { label: "Base64 (base 64)", value: "Base64" },
  { label: "Base64url (URL safe)", value: "Base64url" },
  { label: "Binary (base 2)", value: "Bin" },
];

// ============ 工具函数 ============

function convertHexToBin(hex: string): string {
  return hex.trim().split("").map((byte) => parseInt(byte, 16).toString(2).padStart(4, "0")).join("");
}

function formatWithEncoding(wordArray: CryptoJS.lib.WordArray, encoding: Encoding): string {
  switch (encoding) {
    case "Bin": return convertHexToBin(wordArray.toString(enc.Hex));
    case "Base64url": return wordArray.toString(enc.Base64).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    case "Base64": return wordArray.toString(enc.Base64);
    default: return wordArray.toString(enc.Hex);
  }
}

function hashText(algorithm: HashAlgorithm, text: string, encoding: Encoding = "Hex"): string {
  const algorithms: Record<HashAlgorithm, (text: string) => CryptoJS.lib.WordArray> = {
    MD5, SHA1, SHA256, SHA224, SHA512, SHA384, SHA3, RIPEMD160,
  };
  const wordArray = algorithms[algorithm](text);
  return formatWithEncoding(wordArray, encoding);
}

// ============ 核心功能组件 ============

function HashTextCore() {
  const [inputText, setInputText] = useState("");
  const [encoding, setEncoding] = useState<Encoding>("Hex");
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // ✅ 修复：始终返回正确类型的对象
  const hashes = useMemo(() => {
    return ALGORITHMS.reduce((acc, { value }) => {
      acc[value] = inputText ? hashText(value, inputText, encoding) : "";
      return acc;
    }, {} as Record<HashAlgorithm, string>);
  }, [inputText, encoding]);

  const copyToClipboard = async (text: string, algo: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHash(algo);
      setTimeout(() => setCopiedHash(null), 1500);
    } catch (err) { console.error("复制失败:", err); }
  };

  const handleRegenerate = () => {
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 300);
  };

  const handleClear = () => setInputText("");

  return (
    <>
      {/* 输入区域 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <label className="font-semibold text-slate-700">待哈希文本</label>
          {inputText && (
            <button onClick={handleClear} className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">
              清空
            </button>
          )}
        </div>
        <textarea
          value={inputText}
          onChange={(e) => { setInputText(e.target.value); handleRegenerate(); }}
          placeholder="输入任意文本进行哈希计算..."
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-slate-800 min-h-[120px] focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-y"
          autoFocus
        />
        <div className="text-right text-xs text-slate-400 mt-2">{inputText.length} 个字符</div>
      </div>

      {/* 编码选择 */}
      <div className="mb-6">
        <label className="font-semibold text-slate-700 block mb-3">输出编码格式</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ENCodings.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setEncoding(opt.value); handleRegenerate(); }}
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
          // ✅ 现在 TypeScript 知道 hashes 有 HashAlgorithm 键
          const hashValue = hashes[value] || "";
          const isCopied = copiedHash === label;
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
                hashValue ? colorClasses[color] : "bg-slate-50 border-slate-200 text-slate-400"
              } ${isGenerating ? "animate-pulse" : ""}`}
            >
              <span className="font-mono font-bold w-24 text-sm shrink-0">{label}</span>
              <input
                readOnly
                value={hashValue || "—"}
                className="flex-1 bg-transparent border-0 font-mono text-sm truncate focus:outline-none"
                placeholder="等待输入..."
              />
              <button
                onClick={() => copyToClipboard(hashValue, label)}
                disabled={!hashValue}
                className={`p-2.5 rounded-xl transition-all shrink-0 ${
                  isCopied ? "bg-green-100 text-green-600" : "bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isCopied ? "已复制" : "复制哈希值"}
              >
                {isCopied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          );
        })}
      </div>

      {/* 空状态提示 */}
      {!inputText && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-sm flex items-start gap-2">
          <span>💡</span>
          <span>在上方输入文本，即可实时生成各种哈希值。所有计算均在本地完成，数据不会上传。</span>
        </div>
      )}

      {/* 重新生成按钮 */}
      <button
        onClick={handleRegenerate}
        disabled={!inputText}
        className="w-full mt-6 flex items-center justify-center py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 hover:-translate-y-0.5 transition-all shadow-md shadow-indigo-600/20 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        <RefreshCw size={18} className={`mr-2 ${isGenerating ? "animate-spin" : ""}`} />
        重新计算哈希
      </button>
    </>
  );
}

// ============ 页面导出 ============

export default function HashTextPage() {
  return (
    <ToolShell>
      <HashTextCore />
    </ToolShell>
  );
}