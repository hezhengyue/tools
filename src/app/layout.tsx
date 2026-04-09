// src/app/layout.tsx
import type { Metadata, Viewport } from "next";  // 👈 1. 导入 Viewport 类型
import "./globals.css";
import Sidebar from "../components/Sidebar";
import MobileHeader from "../components/MobileHeader";

// 2. 单独的 metadata 导出（不要放 viewport）
export const metadata: Metadata = {
  title: "正月工具箱",
  description: "为小白和开发者打造的极简现代在线工具集合站",
  // ✅ 其他元数据可以放这里
  icons: {
    icon: "/favicon.ico",
  },
};

// 3. 单独的 viewport 导出 👈 关键修复
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // 可选：适配深色模式
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="font-sans flex h-screen bg-slate-50/50 overflow-hidden">
        <Sidebar className="hidden md:flex" />
        <main className="flex-1 overflow-auto w-full md:w-[calc(100%-18rem)] relative">
          <MobileHeader />
          <div className="h-full p-4 sm:p-6 md:p-8 lg:p-12 max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}