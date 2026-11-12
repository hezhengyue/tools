"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Notice, OutputBlock } from "@/components/ui/ToolUI";

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
  const [genError, setGenError] = useState("");

  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimeoutTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  // =========================
  // worker init（初始化与超时重建共用同一套消息绑定）
  // =========================
  const setupWorker = useCallback(() => {
    workerRef.current?.terminate();
    let worker: Worker;
    try {
      worker = new Worker(new URL("./ssh.worker.ts", import.meta.url));
    } catch {
      // 不在 effect 里同步 setState；generate() 会检查并给出提示
      workerRef.current = null;
      return;
    }
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<KeyPair & { error?: string }>) => {
      clearTimeoutTimer();
      setLoading(false);
      const data = e.data;
      // Worker 失败时返回 { error }，不能当成成功结果渲染出空密钥
      if (data?.error || !data?.publicKey || !data?.privateKey) {
        setGenError(`密钥生成失败：${data?.error || "返回结果不完整"}`);
        return;
      }
      setGenError("");
      setKeyPair(data);
    };

    worker.onerror = () => {
      clearTimeoutTimer();
      setLoading(false);
      setGenError("密钥生成线程异常，请降低位数后重试");
    };
  }, []);

  useEffect(() => {
    setupWorker();
    return () => {
      clearTimeoutTimer();
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [setupWorker]);

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
    if (!workerRef.current) {
      setGenError("浏览器不支持 Web Worker，无法生成密钥");
      return;
    }
    clearTimeoutTimer();
    setGenError("");
    setLoading(true);
    workerRef.current.postMessage({ type: "rsa", bits: keySize });

    // 4096 位在慢设备上可能很久，超时兜底避免一直卡在「生成中...」
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setGenError("生成超时，已重置生成线程，请重试或改用 2048 位");
      setupWorker();
    }, keySize === 4096 ? 120000 : 60000);
  }, [keySize, setupWorker]);

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

      {genError && <Notice tone="error" role="alert">{genError}</Notice>}

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
