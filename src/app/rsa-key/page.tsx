// app/rsa-key/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import forge from "node-forge";
import { Copy, Check, RefreshCw, Download, Key } from "lucide-react";
import ToolShell from "@/components/ToolShell";

// ============ 类型定义 ============

type KeySize = 1024 | 2048 | 4096;

interface KeyPair {
  publicKey: string;
  privateKey: string;
  generatedAt: number;
}

// ============ 核心功能组件（只写业务逻辑） ============

function RsaKeyGeneratorCore() {
  const [keySize, setKeySize] = useState<KeySize>(2048);
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<"public" | "private" | null>(null);
  const [error, setError] = useState<string>("");

  // 生成 RSA 密钥对（浏览器本地执行）
  const generateKeyPair = useCallback(async (bits: KeySize) => {
    setIsGenerating(true);
    setError("");
    
    try {
      // 使用 setTimeout 让 UI 先更新加载状态
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // node-forge 生成密钥对（同步但可能较慢）
      const keys = forge.pki.rsa.generateKeyPair(bits);
      
      // 转换为 PEM 格式
      const publicKey = forge.pki.publicKeyToPem(keys.publicKey);
      const privateKey = forge.pki.privateKeyToPem(keys.privateKey);
      
      setKeyPair({
        publicKey,
        privateKey,
        generatedAt: Date.now(),
      });
    } catch (err: any) {
      console.error("密钥生成失败:", err);
      setError(err.message || "生成密钥对失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // 初始生成 + 密钥长度变更时重新生成
  useEffect(() => {
    generateKeyPair(keySize);
  }, [keySize, generateKeyPair]);

  // 复制功能
  const copyToClipboard = async (text: string, type: "public" | "private") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(type);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  // 下载功能
  const downloadKey = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "application/x-pem-file" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 刷新密钥
  const handleRefresh = () => {
    generateKeyPair(keySize);
  };

  // 密钥长度选项
  const KEY_SIZES: { value: KeySize; label: string; desc: string }[] = [
    { value: 1024, label: "1024 位", desc: "快速，适合测试" },
    { value: 2048, label: "2048 位", desc: "推荐，安全平衡" },
    { value: 4096, label: "4096 位", desc: "最高安全，生成较慢" },
  ];

  return (
    <>
      {/* 密钥长度选择 */}
      <div className="mb-6">
        <label className="font-semibold text-slate-700 block mb-3">密钥长度</label>
        <div className="grid grid-cols-3 gap-3">
          {KEY_SIZES.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setKeySize(opt.value)}
              disabled={isGenerating}
              className={`p-3 rounded-xl text-left transition-all border disabled:opacity-50 ${
                keySize === opt.value
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              <div className="font-medium text-sm">{opt.label}</div>
              <div className={`text-xs ${keySize === opt.value ? "text-indigo-200" : "text-slate-400"}`}>
                {opt.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
          <span>⚠️</span>
          {error}
        </div>
      )}

      {/* 公钥区域 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="font-semibold text-slate-700 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            公钥 (Public Key)
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => keyPair && downloadKey(keyPair.publicKey, "public_key.pem")}
              disabled={!keyPair || isGenerating}
              className="p-2 text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-50"
              title="下载公钥"
            >
              <Download size={16} />
            </button>
            <button
              onClick={() => keyPair && copyToClipboard(keyPair.publicKey, "public")}
              disabled={!keyPair || isGenerating}
              className={`p-2 rounded-lg transition-all ${
                copiedKey === "public"
                  ? "bg-green-100 text-green-600"
                  : "bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200"
              } disabled:opacity-50`}
              title={copiedKey === "public" ? "已复制" : "复制公钥"}
            >
              {copiedKey === "public" ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
        <textarea
          readOnly
          value={keyPair?.publicKey || ""}
          placeholder={isGenerating ? "生成中..." : "等待生成..."}
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-700 min-h-[180px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      {/* 私钥区域 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="font-semibold text-slate-700 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full" />
            私钥 (Private Key) ⚠️ 请妥善保存
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => keyPair && downloadKey(keyPair.privateKey, "private_key.pem")}
              disabled={!keyPair || isGenerating}
              className="p-2 text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-50"
              title="下载私钥"
            >
              <Download size={16} />
            </button>
            <button
              onClick={() => keyPair && copyToClipboard(keyPair.privateKey, "private")}
              disabled={!keyPair || isGenerating}
              className={`p-2 rounded-lg transition-all ${
                copiedKey === "private"
                  ? "bg-green-100 text-green-600"
                  : "bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200"
              } disabled:opacity-50`}
              title={copiedKey === "private" ? "已复制" : "复制私钥"}
            >
              {copiedKey === "private" ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
        <textarea
          readOnly
          value={keyPair?.privateKey || ""}
          placeholder={isGenerating ? "生成中..." : "等待生成..."}
          className="w-full p-4 bg-amber-50/50 border border-amber-200 rounded-2xl font-mono text-xs text-slate-700 min-h-[280px] resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
      </div>

      {/* 刷新按钮 */}
      <button
        onClick={handleRefresh}
        disabled={isGenerating}
        className="w-full flex items-center justify-center py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 hover:-translate-y-0.5 transition-all shadow-md shadow-indigo-600/20 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        <RefreshCw size={18} className={`mr-2 ${isGenerating ? "animate-spin" : ""}`} />
        {isGenerating ? "生成中..." : "重新生成密钥对"}
      </button>

      {/* 生成时间 */}
      {keyPair && !isGenerating && (
        <div className="mt-4 text-center text-xs text-slate-400">
          生成时间: {new Date(keyPair.generatedAt).toLocaleTimeString("zh-CN")}
        </div>
      )}
    </>
  );
}

// ============ 页面导出（用 ToolShell 包裹） ============

export default function RsaKeyPage() {
  return (
    <ToolShell>
      <RsaKeyGeneratorCore />
    </ToolShell>
  );
}