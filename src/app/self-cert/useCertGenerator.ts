// src/app/self-cert/useCertGenerator.ts
import { useCallback, useEffect, useRef, useState } from "react";

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

  hash:
    | "sha256"
    | "sha384"
    | "sha512";

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
  type:
    | "CERT_GENERATED"
    | "CERT_ERROR";

  payload: any;
}

export function useCertGenerator() {
  const workerRef =
    useRef<Worker | null>(null);

  const timeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const requestIdRef =
    useRef<string>("");

  const [result, setResult] =
    useState<CertResult | null>(null);

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    try {
      workerRef.current =
        new Worker(
          new URL(
            "./cert-generator.worker.ts",
            import.meta.url
          ),
          {
            type: "module",
          }
        );

      workerRef.current.onmessage = (
        event: MessageEvent<WorkerMessage>
      ) => {
        const { type, payload } =
          event.data;

        if (
          payload.requestId !==
          requestIdRef.current
        ) {
          return;
        }

        if (timeoutRef.current) {
          clearTimeout(
            timeoutRef.current
          );
        }

        setIsGenerating(false);

        if (
          type ===
          "CERT_GENERATED"
        ) {
          setResult(payload);

          setError(null);

          return;
        }

        if (
          type === "CERT_ERROR"
        ) {
          setResult(null);

          setError(
            payload.error ??
              "生成失败"
          );
        }
      };

      workerRef.current.onerror = (
        err
      ) => {
        if (timeoutRef.current) {
          clearTimeout(
            timeoutRef.current
          );
        }

        setIsGenerating(false);

        setError(
          err.message ??
            "Worker执行失败"
        );
      };
    } catch (err) {
      console.error(err);

      setError(
        "Worker初始化失败"
      );
    }

    return () => {
      workerRef.current?.terminate();

      if (timeoutRef.current) {
        clearTimeout(
          timeoutRef.current
        );
      }
    };
  }, []);

  const generateCert =
    useCallback(
      (
        payload: CertRequestPayload
      ) => {
        if (
          !workerRef.current
        ) {
          setError(
            "Worker未就绪"
          );

          return;
        }

        setResult(null);

        setError(null);

        setIsGenerating(true);

        const requestId =
          crypto.randomUUID();

        requestIdRef.current =
          requestId;

        timeoutRef.current =
          setTimeout(() => {
            setIsGenerating(false);

            setError(
              "证书生成超时（60秒）"
            );
          }, 60000);

        workerRef.current.postMessage(
          {
            type:
              "GENERATE_CERT",

            payload: {
              ...payload,

              requestId,
            },
          }
        );
      },
      []
    );

  return {
    result,

    error,

    isGenerating,

    generateCert,
  };
}