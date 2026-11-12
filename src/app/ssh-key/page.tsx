"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { OutputBlock } from "@/components/ui/ToolUI";

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

  const authorizedCommand = keyPair
    ? `echo "${keyPair.publicKey}" >> ~/.ssh/authorized_keys`
    : "";

  return (
    <div className="space-y-5">

      {/* =========================
          RSA Key Size
      ========================= */}
      <div className="space-y-2">
        <div className="ui-label text-sm">
          选择 RSA Key Size
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleSizeChange(2048)}
            className={`p-3 rounded-xl border text-left transition-all ${
              keySize === 2048
                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                : "bg-white border-slate-200 hover:border-indigo-300"
            }`}
          >
            <div className="font-semibold">2048 bit</div>
            <div className="text-xs opacity-70 mt-1">推荐（平衡性能）</div>
          </button>

          <button
            onClick={() => handleSizeChange(4096)}
            className={`p-3 rounded-xl border text-left transition-all ${
              keySize === 4096
                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                : "bg-white border-slate-200 hover:border-indigo-300"
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
        className="ui-btn ui-btn-primary w-full py-3"
      >
        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        {loading ? "生成中..." : "生成 RSA SSH Key"}
      </button>

      {/* =========================
          public key
      ========================= */}
      <OutputBlock
        label="Public Key"
        value={keyPair?.publicKey || ""}
        copyLabel="复制公钥"
        filename="id_rsa.pub"
        mimeType="application/octet-stream"
        placeholder="点击上方按钮生成密钥..."
        minHeight="min-h-[120px]"
        textareaClassName="text-xs"
      />

      {/* =========================
          private key
      ========================= */}
      <OutputBlock
        label="Private Key"
        hint="请妥善保管，不要分享"
        tone="warning"
        value={keyPair?.privateKey || ""}
        copyLabel="复制私钥"
        filename="id_rsa"
        mimeType="application/octet-stream"
        placeholder="点击上方按钮生成密钥..."
        minHeight="min-h-[200px]"
        textareaClassName="text-xs"
      />

      {/* =========================
          authorized_keys
      ========================= */}
      {keyPair && (
        <OutputBlock
          label="一键写入 authorized_keys"
          value={authorizedCommand}
          copyLabel="复制命令"
          className="pt-2"
        >
          <div className="ui-output-code">
            <code className="block break-all whitespace-pre-wrap font-mono text-xs text-slate-700 leading-relaxed">
              {authorizedCommand}
            </code>
          </div>
        </OutputBlock>
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
