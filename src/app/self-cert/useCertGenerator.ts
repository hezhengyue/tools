// src/app/self-cert/useCertGenerator.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { randomId } from "@/lib/random";

export type SanType = "DNS" | "IP";

export interface SanEntry {
  id: string;
  type: SanType;
  value: string;
}

export interface CertRequestPayload {
  commonName: string;
  sanEntries: SanEntry[];
  keySize: 2048 | 4096;
  hash: "sha256" | "sha384" | "sha512";
  days: number;
  organization?: string;
  country?: string;
}

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
    keySize: number;
    hash: string;
  };
}

interface WorkerMessage {
  type: "CERT_GENERATED" | "CERT_ERROR";
  payload: Partial<CertResult> & {
    requestId?: string;
    error?: string;
  };
}

const GENERATE_TIMEOUT = 60_000;

export function useCertGenerator() {
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef<string>("");
  const [result, setResult] = useState<CertResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent<WorkerMessage>) => {
    const { type, payload } = event.data;
    if (payload.requestId !== requestIdRef.current) return;
    clearTimer();
    requestIdRef.current = "";
    setIsGenerating(false);

    if (type === "CERT_GENERATED") {
      // 结构不完整时按失败处理，避免页面拿到 undefined 私钥还展示"生成成功"
      if (!payload.privateKey || !payload.certificate || !payload.info) {
        setResult(null);
        setError("生成结果不完整，请重试");
        return;
      }
      setResult(payload as CertResult);
      setError(null);
      return;
    }

    if (type === "CERT_ERROR") {
      setResult(null);
      setError(payload.error ?? "生成失败");
    }
  }, [clearTimer]);

  const setupWorker = useCallback(() => {
    workerRef.current?.terminate();
    try {
      const worker = new Worker(
        new URL("./cert-generator.worker.ts", import.meta.url),
        { type: "module" }
      );
      worker.onmessage = handleMessage;
      worker.onerror = (err) => {
        clearTimer();
        requestIdRef.current = "";
        setIsGenerating(false);
        setResult(null);
        setError(err.message || "Worker 执行失败");
      };
      workerRef.current = worker;
    } catch {
      workerRef.current = null;
      queueMicrotask(() => setError("Worker 初始化失败"));
    }
  }, [clearTimer, handleMessage]);

  useEffect(() => {
    setupWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      clearTimer();
    };
  }, [setupWorker, clearTimer]);

  const generateCert = useCallback((payload: CertRequestPayload) => {
    // 超时后 Worker 已被终止，下次生成前重建
    if (!workerRef.current) setupWorker();
    if (!workerRef.current) {
      setError("Worker 未就绪");
      return;
    }

    clearTimer();
    setResult(null);
    setError(null);
    setIsGenerating(true);

    const requestId = randomId("cert_");
    requestIdRef.current = requestId;

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      requestIdRef.current = "";
      setIsGenerating(false);
      setResult(null);
      setError("证书生成超时（60秒），可尝试 2048 位密钥");
      workerRef.current?.terminate();
      workerRef.current = null;
    }, GENERATE_TIMEOUT);

    workerRef.current.postMessage({
      type: "GENERATE_CERT",
      payload: { ...payload, requestId },
    });
  }, [clearTimer, setupWorker]);

  return { result, error, isGenerating, generateCert };
}
