// src/lib/use-image-source.ts
// 图片工具页共用的「当前图片」状态：加载 / 替换 / 移除 / 粘贴，
// 统一管理 ObjectURL 生命周期与并发加载的先后顺序。

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadImageFile, type ImageSource } from "@/lib/image-io";

export function useImageSource() {
  const [source, setSource] = useState<ImageSource | null>(null);
  const [notice, setNotice] = useState("");
  const sourceRef = useRef<ImageSource | null>(null);
  /** 粘贴与选文件可能并发，只让最后一次加载的结果生效 */
  const loadGenRef = useRef(0);

  useEffect(() => { sourceRef.current = source; }, [source]);
  useEffect(() => () => {
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const gen = ++loadGenRef.current;
    try {
      const next = await loadImageFile(file);
      // 后发起的加载已抢先完成，丢弃这次结果，别 revoke 掉正在显示的那张
      if (gen !== loadGenRef.current) {
        URL.revokeObjectURL(next.url);
        return;
      }
      const previous = sourceRef.current;
      sourceRef.current = next;
      setSource(next);
      if (previous && previous.url !== next.url) URL.revokeObjectURL(previous.url);
      setNotice("");
    } catch (cause) {
      if (gen === loadGenRef.current) {
        setNotice(cause instanceof Error ? cause.message : "图片加载失败");
      }
    }
  }, []);

  const clear = useCallback(() => {
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
    sourceRef.current = null;
    setSource(null);
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"));
      if (file) handleFile(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [handleFile]);

  return { source, notice, setNotice, handleFile, clear };
}
