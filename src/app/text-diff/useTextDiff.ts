// app/text-diff/useTextDiff.ts
import { useEffect, useRef, useCallback, useState } from "react";
import type { DiffPart } from "./text-diff.worker";

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

export function useTextDiff(): UseTextDiffReturn {
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [result, setResult] = useState<DiffResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentRequestIdRef = useRef<string>("");

  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL("./text-diff.worker.ts", import.meta.url)
      );

      workerRef.current.onmessage = (e: MessageEvent) => {
        const { type, payload } = e.data;
        
        if (payload.requestId !== currentRequestIdRef.current) return;

        clearTimeout(timerRef.current!);
        setIsComputing(false);

        if (type === "DIFF_COMPLETE") {
          setResult(payload);
          setError(null);
        } else if (type === "DIFF_ERROR") {
          setError(payload.error);
          setResult(null);
        }
      };

      workerRef.current.onerror = (err) => {
        clearTimeout(timerRef.current!);
        setIsComputing(false);
        setError(`Worker 错误: ${err.message || "未知错误"}`);
      };
    } catch (err) {
      setError("无法创建 Worker");
    }

    return () => {
      workerRef.current?.terminate();
      clearTimeout(timerRef.current!);
    };
  }, []);

  const computeDiff = useCallback((payload: DiffRequestPayload) => {
    if (!workerRef.current) {
      setError("Worker 未就绪");
      return;
    }

    setIsComputing(true);
    setError(null);
    setResult(null);
    
    const requestId = `diff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    currentRequestIdRef.current = requestId;

    timerRef.current = setTimeout(() => {
      setIsComputing(false);
      setError("计算超时，文本可能过大");
    }, 10000);

    workerRef.current.postMessage({
      type: "COMPUTE_DIFF",
      payload: { ...payload, requestId },
    });
  }, []);

  return { result, isComputing, error, computeDiff };
}