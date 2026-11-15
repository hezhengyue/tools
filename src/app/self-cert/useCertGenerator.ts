// src/app/self-cert/useCertGenerator.ts
// 自签证书生成的状态机。所有计算都在主线程完成（WebCrypto 异步、不阻塞），
// 不再经过 Web Worker —— 部分部署环境 / 内置浏览器里 Worker 会被静默拦掉，
// 表现为「一直生成中」直到超时。

import { useCallback, useEffect, useRef, useState } from "react";
import { randomId } from "@/lib/random";
import { hasWebCrypto } from "@/lib/rsa-keypair";
import type { CertRequestPayload, CertResult, SanEntry, SanType } from "./cert";

export type { CertRequestPayload, CertResult, SanEntry, SanType };

export function useCertGenerator() {
  const requestIdRef = useRef<string>("");
  const [result, setResult] = useState<CertResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState(0);
  const [nativeEngine, setNativeEngine] = useState(true);

  // 首帧不读浏览器能力，保证水合一致
  useEffect(() => {
    setNativeEngine(hasWebCrypto());
  }, []);

  const generateCert = useCallback(async (payload: CertRequestPayload) => {
    const requestId = randomId("cert_");
    requestIdRef.current = requestId;
    setResult(null);
    setError(null);
    setCost(0);
    setIsGenerating(true);

    // 先让「生成中」渲染出来：没有 WebCrypto 时下一步会同步阻塞主线程
    await new Promise((resolve) => setTimeout(resolve, 30));

    try {
      const { createSelfSignedCert } = await import("./cert");
      const startedAt = performance.now();
      const next = await createSelfSignedCert(payload);
      if (requestIdRef.current !== requestId) return; // 期间又发起了新请求
      setResult(next);
      setCost(Math.max(0.1, Math.round((performance.now() - startedAt) / 100) / 10));
    } catch (cause) {
      if (requestIdRef.current !== requestId) return;
      setResult(null);
      setError(cause instanceof Error ? `证书生成失败：${cause.message}` : "证书生成失败");
    } finally {
      if (requestIdRef.current === requestId) {
        requestIdRef.current = "";
        setIsGenerating(false);
      }
    }
  }, []);

  return { result, error, isGenerating, generateCert, cost, nativeEngine };
}
