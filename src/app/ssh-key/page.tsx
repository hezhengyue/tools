"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Copy, Check, RefreshCw, Download } from "lucide-react";
import ToolShell from "@/components/ToolShell";

type KeyType = "rsa" | "ed25519";
type KeySize = 2048 | 4096;

interface KeyPair {
  publicKey: string;
  privateKey: string;
  type: KeyType;
  generatedAt: number;
}

function SshKeyCore() {
  const [type, setType] = useState<KeyType>("ed25519");
  const [keySize, setKeySize] = useState<KeySize>(2048);
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"pub" | "pri" | null>(null);

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
  // RSA size UI控制
  // =========================
  const handleSizeChange = (size: KeySize) => {
    setKeySize(size);
  };

  // =========================
  // 自动推荐逻辑
  // =========================
  useEffect(() => {
    if (type === "ed25519") {
      // ed25519 不需要 size，但保留默认值不影响
      return;
    }

    // RSA 默认 2048
    setKeySize(2048);
  }, [type]);

  // =========================
  // 生成 key
  // =========================
  const generate = useCallback(() => {
    setLoading(true);

    workerRef.current?.postMessage({
      type,
      bits: keySize,
    });
  }, [type, keySize]);

  // =========================
  // copy
  // =========================
  const copy = async (text: string, k: "pub" | "pri") => {
    await navigator.clipboard.writeText(text);
    setCopied(k);
    setTimeout(() => setCopied(null), 1200);
  };

  const authorizedCommand = keyPair
    ? `echo "${keyPair.publicKey}" >> ~/.ssh/authorized_keys`
    : "";

  return (
    <div className="space-y-5">

      {/* =========================
          类型选择
      ========================= */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setType("ed25519")}
          className={`p-3 rounded-xl border ${
            type === "ed25519"
              ? "bg-indigo-600 text-white"
              : "bg-white"
          }`}
        >
          Ed25519（推荐）
        </button>

        <button
          onClick={() => setType("rsa")}
          className={`p-3 rounded-xl border ${
            type === "rsa"
              ? "bg-indigo-600 text-white"
              : "bg-white"
          }`}
        >
          RSA
        </button>
      </div>

      {/* =========================
          RSA Key Size 选择（核心新增）
      ========================= */}
      {type === "rsa" && (
        <div className="space-y-2">
          <div className="text-sm text-slate-500">
            选择 RSA Key Size
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSizeChange(2048)}
              className={`p-3 rounded-xl border text-left ${
                keySize === 2048
                  ? "bg-indigo-600 text-white"
                  : "bg-white"
              }`}
            >
              <div className="font-semibold">2048 bit</div>
              <div className="text-xs opacity-70">
                推荐（平衡性能）
              </div>
            </button>

            <button
              onClick={() => handleSizeChange(4096)}
              className={`p-3 rounded-xl border text-left ${
                keySize === 4096
                  ? "bg-indigo-600 text-white"
                  : "bg-white"
              }`}
            >
              <div className="font-semibold">4096 bit</div>
              <div className="text-xs opacity-70">
                更安全（较慢）
              </div>
            </button>
          </div>
        </div>
      )}

      {/* =========================
          生成按钮
      ========================= */}
      <button
        onClick={generate}
        disabled={loading}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl flex justify-center"
      >
        <RefreshCw
          className={loading ? "animate-spin mr-2" : "mr-2"}
        />
        {loading ? "生成中..." : "生成 SSH Key"}
      </button>

      {/* =========================
          公钥
      ========================= */}
      <div>
        <div className="flex justify-between mb-2">
          <label>Public Key</label>

          <div className="flex gap-2">
            {/* 复制 */}
            <button onClick={() => keyPair && copy(keyPair.publicKey, "pub")}>
              {copied === "pub" ? <Check /> : <Copy />}
            </button>

            {/* 下载公钥（新增） */}
            <button
              onClick={() => {
                if (!keyPair) return;

                const blob = new Blob([keyPair.publicKey], {
                  type: "application/octet-stream",
                });

                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `id_${keyPair.type}.pub`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download />
            </button>
          </div>
        </div>

        <textarea
          readOnly
          value={keyPair?.publicKey || ""}
          className="w-full min-h-[120px] font-mono text-xs p-3 bg-slate-50 rounded-xl"
        />
      </div>

      {/* =========================
          私钥
      ========================= */}
      <div>
        <div className="flex justify-between mb-2">
          <label className="text-amber-600">Private Key</label>

          <div className="flex gap-2">
            {/* 复制 */}
            <button onClick={() => keyPair && copy(keyPair.privateKey, "pri")}>
              {copied === "pri" ? <Check /> : <Copy />}
            </button>

            {/* 下载私钥（新增） */}
            <button
              onClick={() => {
                if (!keyPair) return;

                const blob = new Blob([keyPair.privateKey], {
                  type: "application/octet-stream",
                });

                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;

                const ext = keyPair.type === "rsa" ? "rsa" : "ed25519";
                a.download = `id_${ext}`;

                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download />
            </button>
          </div>
        </div>

        <textarea
          readOnly
          value={keyPair?.privateKey || ""}
          className="w-full min-h-[200px] font-mono text-xs p-3 bg-amber-50 rounded-xl"
        />
      </div>

      {/* =========================
          authorized_keys
      ========================= */}
      {keyPair && (
        <div className="p-3 bg-slate-100 rounded-xl text-xs">
          <div className="font-semibold mb-2">
            一键写入 authorized_keys
          </div>

          <code className="break-all">
            {authorizedCommand}
          </code>

          <button
            className="mt-2 text-indigo-600"
            onClick={() => copy(authorizedCommand, "pub")}
          >
            复制命令
          </button>
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