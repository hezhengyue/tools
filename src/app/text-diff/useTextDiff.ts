// app/text-diff/useTextDiff.ts
import { useEffect, useRef, useCallback, useState } from "react";
import type { DiffPart } from "./text-diff.worker";
import { randomId } from "@/lib/random";

export type DiffMode = "chars" | "words" | "lines";

export type DiffRequestPayload = {
  oldText: string;
  newText: string;
  mode: DiffMode;
};

export interface DiffResult {
  diffs: DiffPart[];
  stats: {
    added: number;
    removed: number;
    unchanged: number;
  };
}

interface UseTextDiffReturn {
  result: DiffResult | null;
  isComputing: boolean;
  error: string | null;
  computeDiff: (payload: DiffRequestPayload) => void;
}

const COMPUTE_TIMEOUT = 10_000;

export function useTextDiff(): UseTextDiffReturn {
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRequestIdRef = useRef<string>("");
  const [result, setResult] = useState<DiffResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    const { type, payload } = event.data ?? {};
    // 超时/新请求会让旧 id 失效，迟到的结果必须丢弃，不能覆盖超时提示
    if (!payload || payload.requestId !== currentRequestIdRef.current) return;
    clearTimer();
    currentRequestIdRef.current = "";
    setIsComputing(false);
    if (type === "DIFF_COMPLETE") {
      setResult(payload);
      setError(null);
    } else if (type === "DIFF_ERROR") {
      setError(payload.error);
      setResult(null);
    }
  }, [clearTimer]);

  const setupWorker = useCallback(() => {
    workerRef.current?.terminate();
    try {
      const worker = new Worker(new URL("./text-diff.worker.ts", import.meta.url));
      worker.onmessage = handleMessage;
      worker.onerror = (err) => {
        clearTimer();
        currentRequestIdRef.current = "";
        setIsComputing(false);
        setError(`Worker 错误: ${err.message || "未知错误"}`);
      };
      workerRef.current = worker;
    } catch {
      workerRef.current = null;
      queueMicrotask(() => setError("无法创建 Worker"));
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

  const computeDiff = useCallback((payload: DiffRequestPayload) => {
    // 超时会终止 Worker，下次调用按需重建
    if (!workerRef.current) setupWorker();
    if (!workerRef.current) {
      setError("Worker 未就绪");
      return;
    }

    clearTimer();
    setIsComputing(true);
    setError(null);
    setResult(null);

    const requestId = randomId("diff_");
    currentRequestIdRef.current = requestId;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      currentRequestIdRef.current = "";
      setIsComputing(false);
      setResult(null);
      setError("计算超时，文本可能过大");
      // 终止仍在跑的 diff，释放线程；旧消息随之消失，不会覆盖超时提示
      workerRef.current?.terminate();
      workerRef.current = null;
    }, COMPUTE_TIMEOUT);

    workerRef.current.postMessage({
      type: "COMPUTE_DIFF",
      payload: { ...payload, requestId },
    });
  }, [clearTimer, setupWorker]);

  return { result, isComputing, error, computeDiff };
}
