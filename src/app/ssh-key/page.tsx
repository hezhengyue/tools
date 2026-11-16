"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { ActionBar, Button, Notice, OutputBlock } from "@/components/ui/ToolUI";
import { hasWebCrypto } from "@/lib/rsa-keypair";
import type { SshKeyPair } from "./keygen";

type KeySize = 2048 | 4096;

function SshKeyCore() {
  const [keySize, setKeySize] = useState<KeySize>(2048);
  const [keyPair, setKeyPair] = useState<SshKeyPair | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cost, setCost] = useState(0);
  const [genError, setGenError] = useState("");
  // 挂载后才判断，避免首帧与服务端渲染不一致
  const [nativeEngine, setNativeEngine] = useState(true);

  const requestIdRef = useRef(0);
  const generatingRef = useRef(false);

  useEffect(() => {
    setNativeEngine(hasWebCrypto());
  }, []);

  // 生成期间显示已用时：JS 兜底路径要等几十秒，没有计时会像卡死
  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [loading]);

  const generate = useCallback(async () => {
    // 同步防重入：按钮 disabled 要等下一次渲染才生效
    if (generatingRef.current) return;
    generatingRef.current = true;
    const requestId = ++requestIdRef.current;

    setGenError("");
    setKeyPair(null);
    setCost(0);
    setElapsed(0);
    setLoading(true);

    // 先让「生成中」渲染出来：没有 WebCrypto 时下一步会同步阻塞主线程
    await new Promise((resolve) => setTimeout(resolve, 30));

    try {
      // forge 体积不小，按需加载，不拖首屏
      const { createSshKeyPair } = await import("./keygen");
      const startedAt = performance.now();
      const pair = await createSshKeyPair(keySize);
      if (requestIdRef.current !== requestId) return;
      setKeyPair(pair);
      setCost(Math.max(0.1, Math.round((performance.now() - startedAt) / 100) / 10));
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      setGenError(`密钥生成失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      if (requestIdRef.current === requestId) {
        generatingRef.current = false;
        setLoading(false);
      }
    }
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setKeySize(2048)}
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
            onClick={() => setKeySize(4096)}
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
      <ActionBar>
        <Button variant="primary" size="lg" onClick={() => void generate()} disabled={loading} icon={RefreshCw}>
          {loading ? `生成中… ${elapsed}s` : "生成 RSA SSH Key"}
        </Button>
      </ActionBar>

      {loading && nativeEngine && (
        <Notice tone="info">
          正在用浏览器原生加密接口生成，2048 位通常 1 秒内完成，4096 位约几秒，请勿关闭页面。
        </Notice>
      )}

      {loading && !nativeEngine && (
        <Notice tone="tip">
          当前浏览器没有提供原生加密接口（需要 HTTPS 或 localhost，部分内置浏览器也不支持），
          只能用纯 JS 实现生成，4096 位可能需要 30 秒以上，期间页面会无响应。建议改用 2048 位或换桌面浏览器。
        </Notice>
      )}

      {genError && <Notice tone="error" role="alert">{genError}</Notice>}

      {keyPair && (
        <Notice tone="success">
          生成完成，耗时 {cost} 秒（{keyPair.source === "webcrypto" ? "原生加密接口" : "JS 实现"}）。
        </Notice>
      )}

      {/* =========================
          公钥 / 私钥：生成前不占位，避免页面一打开就是两个空框
      ========================= */}
      {keyPair && (
        <>
          <OutputBlock
            label="Public Key"
            value={keyPair.publicKey}
            copyLabel="复制公钥"
            filename="id_rsa.pub"
            mimeType="application/octet-stream"
            textareaClassName="text-xs"
          />

          <OutputBlock
            label="Private Key"
            hint="请妥善保管，不要分享"
            tone="warning"
            value={keyPair.privateKey}
            copyLabel="复制私钥"
            filename="id_rsa"
            mimeType="application/octet-stream"
            textareaClassName="text-xs"
          />
        </>
      )}

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
