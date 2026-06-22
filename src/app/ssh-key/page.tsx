"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Copy, Check, RefreshCw, Download } from "lucide-react";
import ToolShell from "@/components/ToolShell";

type KeySize = 2048 | 4096;

interface KeyPair {
  publicKey: string;
  privateKey: string;
  type: "rsa";
  generatedAt: number;
}

function SshKeyCore() {
  const [keySize, setKeySize] = useState<KeySize>(2048);
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ 修复：3路状态隔离
  const [copied, setCopied] = useState<"pub" | "pri" | "cmd" | null>(null);

  const workerRef = useRef<Worker | null>(null);

  // =========================
  // worker init
  // =========================
  useEffect(() => {
    workerRef.current = new Worker(
      new URL("./ssh.worker.ts", import.meta.url)
    );

    workerRef.current.onmessage = (e) => {
      setKeyPair(e.data);
      setLoading(false);
    };

    return () => workerRef.current?.terminate();
  }, []);

  // =========================
  // size change
  // =========================
  const handleSizeChange = (size: KeySize) => {
    setKeySize(size);
  };

  // =========================
  // generate key
  // =========================
  const generate = useCallback(() => {
    setLoading(true);

    workerRef.current?.postMessage({
      type: "rsa",
      bits: keySize,
    });
  }, [keySize]);

  // =========================
  // copy
  // =========================
  const copy = async (
    text: string,
    k: "pub" | "pri" | "cmd"
  ) => {
    await navigator.clipboard.writeText(text);
    setCopied(k);
    setTimeout(() => setCopied(null), 1200);
  };

  const authorizedCommand = keyPair
    ? `echo "${keyPair.publicKey}" >> ~/.ssh/authorized_keys`
    : "";

  // =========================
  // UI button base style（统一视觉）
  // =========================
  const iconBtn =
    "p-1 rounded hover:bg-slate-200 transition flex items-center justify-center";

  return (
    <div className="space-y-5">

      {/* =========================
          RSA Key Size
      ========================= */}
      <div className="space-y-2">
        <div className="text-sm text-slate-500">
          选择 RSA Key Size
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleSizeChange(2048)}
            className={`p-3 rounded-xl border text-left ${
              keySize === 2048
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="font-semibold">2048 bit</div>
            <div className="text-xs opacity-70 mt-1">推荐（平衡性能）</div>
          </button>

          <button
            onClick={() => handleSizeChange(4096)}
            className={`p-3 rounded-xl border text-left ${
              keySize === 4096
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="font-semibold">4096 bit</div>
            <div className="text-xs opacity-70 mt-1">更安全（较慢）</div>
          </button>
        </div>
      </div>

      {/* =========================
          generate
      ========================= */}
      <button
        onClick={generate}
        disabled={loading}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl flex justify-center items-center font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <RefreshCw
          className={loading ? "animate-spin mr-2" : "mr-2"}
          size={18}
        />
        {loading ? "生成中..." : "生成 RSA SSH Key"}
      </button>

      {/* =========================
          public key
      ========================= */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="font-medium text-slate-700">Public Key</label>

          <div className="flex gap-2">
            <button
              onClick={() =>
                keyPair && copy(keyPair.publicKey, "pub")
              }
              className={iconBtn}
              title="复制公钥"
            >
              {copied === "pub" ? (
                <Check size={16} className="text-green-600" />
              ) : (
                <Copy size={16} className="text-slate-500" />
              )}
            </button>

            <button
              className={iconBtn}
              onClick={() => {
                if (!keyPair) return;

                const blob = new Blob(
                  [keyPair.publicKey],
                  { type: "application/octet-stream" }
                );

                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `id_rsa.pub`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              title="下载公钥"
            >
              <Download size={16} className="text-slate-500" />
            </button>
          </div>
        </div>

        <textarea
          readOnly
          value={keyPair?.publicKey || ""}
          placeholder="点击上方按钮生成密钥..."
          className="w-full min-h-[120px] font-mono text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y"
        />
      </div>

      {/* =========================
          private key
      ========================= */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="font-medium text-amber-600">
            Private Key
          </label>

          <div className="flex gap-2">
            <button
              onClick={() =>
                keyPair && copy(keyPair.privateKey, "pri")
              }
              className={iconBtn}
              title="复制私钥"
            >
              {copied === "pri" ? (
                <Check size={16} className="text-green-600" />
              ) : (
                <Copy size={16} className="text-slate-500" />
              )}
            </button>

            <button
              className={iconBtn}
              onClick={() => {
                if (!keyPair) return;

                const blob = new Blob(
                  [keyPair.privateKey],
                  { type: "application/octet-stream" }
                );

                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `id_rsa`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              title="下载私钥"
            >
              <Download size={16} className="text-slate-500" />
            </button>
          </div>
        </div>

        <textarea
          readOnly
          value={keyPair?.privateKey || ""}
          placeholder="点击上方按钮生成密钥..."
          className="w-full min-h-[200px] font-mono text-xs p-3 bg-amber-50/50 border border-amber-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-y text-amber-900"
        />
      </div>

      {/* =========================
          authorized_keys (已修复布局)
      ========================= */}
      {keyPair && (
        <div className="space-y-2 pt-2">
          
          {/* 标题行 + 按钮行 (与上方保持一致) */}
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-semibold text-slate-700">
              一键写入 authorized_keys
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => copy(authorizedCommand, "cmd")}
                className={iconBtn}
                title="复制命令"
              >
                {copied === "cmd" ? (
                  <Check size={16} className="text-green-600" />
                ) : (
                  <Copy size={16} className="text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {/* 代码内容区 */}
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl overflow-x-auto">
            <code className="block break-all whitespace-pre-wrap font-mono text-xs text-slate-700 leading-relaxed">
              {authorizedCommand}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SshKeyPage() {
  return (
    <ToolShell>
      <SshKeyCore />
    </ToolShell>
  );
}