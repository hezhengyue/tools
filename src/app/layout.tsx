// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import MobileHeader from "../components/MobileHeader";
import { SITE_NAME, SITE_DESCRIPTION } from "@/config/site";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 不设置 maximumScale / userScalable: false —— 允许用户缩放（WCAG 1.4.4）
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