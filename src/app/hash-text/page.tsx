// app/hash-text/page.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
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
// crypto-js 的 SHA3 用的是 Keccak padding(0x01)，不是 NIST SHA-3 的 0x06；
// 标准 SHA3-256/512 必须用专门实现，否则与 openssl / node crypto 的结果不一致。
import { sha3_256, sha3_512 } from "@noble/hashes/sha3.js";
import ToolShell from "@/components/ToolShell";
import { Button, CopyButton, Segmented } from "@/components/ui/ToolUI";

// ============ 类型定义 ============

type HashAlgorithm =
  | "MD5" | "SHA1" | "SHA256" | "SHA224" | "SHA512" | "SHA384"
  | "SHA3-256" | "SHA3-512" | "Keccak-512" | "RIPEMD160";
type Encoding = "Hex" | "Base64" | "Base64url" | "Bin";
type WordArray = CryptoJS.lib.WordArray;

const ALGORITHMS: { label: string; value: HashAlgorithm; color: string }[] = [
  { label: "MD5", value: "MD5", color: "indigo" },
  { label: "SHA1", value: "SHA1", color: "blue" },
  { label: "SHA224", value: "SHA224", color: "cyan" },
  { label: "SHA256", value: "SHA256", color: "emerald" },
  { label: "SHA384", value: "SHA384", color: "teal" },
  { label: "SHA512", value: "SHA512", color: "violet" },
  { label: "SHA3-256", value: "SHA3-256", color: "purple" },
  { label: "SHA3-512", value: "SHA3-512", color: "violet" },
  { label: "Keccak-512", value: "Keccak-512", color: "pink" },
  { label: "RIPEMD160", value: "RIPEMD160", color: "cyan" },
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

const CRYPTOJS_ALGORITHMS = {
  MD5, SHA1, SHA256, SHA224, SHA512, SHA384,
  "Keccak-512": SHA3, RIPEMD160,
} satisfies Record<string, (text: string) => WordArray>;

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

function hashText(algorithm: HashAlgorithm, text: string, encoding: Encoding = "Hex"): string {
  let wordArray: WordArray;
  if (algorithm === "SHA3-256" || algorithm === "SHA3-512") {
    const bytes = new TextEncoder().encode(text);
    const digest = algorithm === "SHA3-256" ? sha3_256(bytes) : sha3_512(bytes);
    wordArray = Hex.parse(bytesToHex(digest));
  } else {
    wordArray = CRYPTOJS_ALGORITHMS[algorithm](text);
  }
  return formatWithEncoding(wordArray, encoding);
}

// ============ 核心功能组件 ============

function HashTextCore() {
  const [inputText, setInputText] = useState("");
  // 防抖后的文本：连续输入时不再每敲一个字符就同步算 8 种哈希
  const [debouncedText, setDebouncedText] = useState("");
  const [encoding, setEncoding] = useState<Encoding>("Hex");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedText(inputText), 250);
    return () => clearTimeout(timer);
  }, [inputText]);

  const hashes = useMemo(() => {
    return ALGORITHMS.reduce((acc, { value }) => {
      acc[value] = debouncedText ? hashText(value, debouncedText, encoding) : "";
      return acc;
    }, {} as Record<HashAlgorithm, string>);
  }, [debouncedText, encoding]);

  const handleClear = () => {
    setInputText("");
    setDebouncedText("");
  };

  return (
    <>
      {/* 输入区域 */}
      <div className="mb-6">
        <div className="ui-field-head">
          <label htmlFor="hash-input" className="ui-label">哈希文本</label>
          <div className="ui-field-actions">
            <Button variant="ghost" size="sm" disabled={!inputText} onClick={handleClear}>清空</Button>
          </div>
        </div>
        <textarea
          id="hash-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="输入任意文本进行哈希计算..."
          className="ui-textarea ui-editor-sm"
          autoFocus
        />
        <div className="text-right text-xs text-slate-500 mt-2">{inputText.length} 个字符</div>
      </div>

      {/* 编码选择 */}
      <div className="mb-6">
        <span className="ui-label mb-2 block">输出编码格式</span>
        <Segmented
          label="输出编码格式"
          value={encoding}
          onChange={setEncoding}
          options={ENCODINGS.map((opt) => ({ value: opt.value, label: opt.label }))}
        />
      </div>

      {/* 哈希结果列表：一个容器 + 细分隔线，避免十条彩色块抢视觉 */}
      <div className="ui-list divide-y divide-slate-100">
        {ALGORITHMS.map(({ label, value }) => {
          const hashValue = hashes[value] || "";

          return (
            <div key={value} className="flex items-center gap-3 px-3 py-2.5">
              <span className="font-mono font-semibold w-24 text-[13px] text-slate-500 shrink-0">{label}</span>
              <input
                readOnly
                value={hashValue || "—"}
                aria-label={`${label} 哈希值`}
                className={`flex-1 bg-transparent border-0 font-mono text-[13px] truncate focus:outline-none ${
                  hashValue ? "text-slate-700" : "text-slate-400"
                }`}
                placeholder="等待输入..."
              />
              <CopyButton value={hashValue} label={`复制 ${label} 哈希值`} />
            </div>
          );
        })}
      </div>

      <p className="ui-note mt-4">
        {inputText
          ? "SHA3 系列是 NIST 标准，可用 openssl dgst -sha3-256 校验；Keccak-512 用旧版填充，结果不同，多见于以太坊。"
          : "输入文本即自动计算；SHA3 系列是 NIST 标准，Keccak-512 填充不同，多见于以太坊。"}
      </p>
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
