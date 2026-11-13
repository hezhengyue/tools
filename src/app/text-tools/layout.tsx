// /text-tools 的 metadata 载体：页面本身是 "use client"，Next.js 不允许在客户端组件里导出 metadata。
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { toolMetadata } from "@/config/metadata";

export const metadata: Metadata = toolMetadata("/text-tools");

export default function TextToolsLayout({ children }: { children: ReactNode }) {
  return children;
}
