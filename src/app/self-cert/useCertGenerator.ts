// app/self-cert/useCertGenerator.ts
import { useEffect, useRef, useCallback, useState } from "react";

export type SanType = "DNS" | "IP" | "Email" | "URI";

export type SanEntry = {
  id: string;
  type: SanType;
  value: string;
};

export type CertRequestPayload = {
  commonName: string;
  sanEntries: SanEntry[];
  keySize: 2048 | 4096;
  hash: "sha256" | "sha384" | "sha512";
  days: number;
  organization?: string;
  country?: string;
};

export interface CertResult {
  privateKey: string;
  certificate: string;
  generatedAt: number;
  info: {
    subject: string;
    issuer: string;
    notBefore: string;
    notAfter: string;
    san: string[];
  };
}

interface UseCertGeneratorReturn {
  result: CertResult | null;
  isGenerating: boolean;
  error: string | null;
  generateCert: (payload: CertRequestPayload) => void;
}

export function useCertGenerator(): UseCertGeneratorReturn {
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [result, setResult] = useState<CertResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ✅ 保存完整的 requestId 字符串（修复匹配问题）
  const currentRequestIdRef = useRef<string>("");

  useEffect(() => {
    console.log("[Hook] 🟢 初始化 Worker...");
    try {
      // ✅ 路径调整：当前目录下的 worker 文件
      workerRef.current = new Worker(
        new URL("./cert-generator.worker.ts", import.meta.url)
      );

      workerRef.current.onmessage = (e: MessageEvent) => {
        console.log("[Hook] 📥 收到 Worker 消息:", e.data);
        
        const { type, payload } = e.data;
        
        // ✅ 比较完整的 requestId 字符串
        if (payload.requestId !== currentRequestIdRef.current) {
          console.warn(
            `[Hook] ⚠️ 忽略不匹配的请求: ` +
            `期望 ${currentRequestIdRef.current}, ` +
            `收到 ${payload.requestId}`
          );
          return;
        }

        clearTimeout(timerRef.current!);
        setIsGenerating(false);

        if (type === "CERT_GENERATED") {
          console.log("[Hook] 🟢 生成成功");
          setResult({
            privateKey: payload.privateKey,
            certificate: payload.certificate,
            generatedAt: payload.generatedAt,
            info: payload.info,
          });
          setError(null);
        } else if (type === "CERT_ERROR") {
          console.error("[Hook] 🔴 生成失败:", payload.error);
          setError(payload.error || "未知错误");
          setResult(null);
        }
      };

      workerRef.current.onerror = (err) => {
        console.error("[Hook] 🔴 Worker 错误:", err);
        clearTimeout(timerRef.current!);
        setIsGenerating(false);
        setError(`Worker 错误: ${err.message || "未知错误"}`);
      };
    } catch (err) {
      console.error("[Hook] 🔴 Worker 初始化失败:", err);
      setError("无法创建 Worker");
    }

    return () => {
      workerRef.current?.terminate();
      clearTimeout(timerRef.current!);
      console.log("[Hook] 🧹 Worker 已清理");
    };
  }, []);

  const generateCert = useCallback((payload: CertRequestPayload) => {
    if (!workerRef.current) {
      setError("Worker 未就绪，请刷新页面");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);
    
    // ✅ 生成完整的 requestId 字符串并保存
    const timestamp = Date.now();
    const requestId = `cert_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
    currentRequestIdRef.current = requestId;
    
    // 设置超时（15 秒）
    timerRef.current = setTimeout(() => {
      setIsGenerating(false);
      setError("生成超时，请重试");
    }, 15000);

    workerRef.current.postMessage({
      type: "GENERATE_CERT",
      payload: { ...payload, requestId },
    });
    console.log(`[Hook] 📤 已发送请求: ${requestId}`);
  }, []);

  return { result, isGenerating, error, generateCert };
}