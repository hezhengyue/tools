// /image-to-base64 的 metadata 载体：页面本身是 "use client"，Next.js 不允许在客户端组件里导出 metadata。
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { toolMetadata } from "@/config/metadata";

export const metadata: Metadata = toolMetadata("/image-to-base64");

export default function ImageToBase64Layout({ children }: { children: ReactNode }) {
  return children;
}
