import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "../components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "正月工具箱",
  description: "为小白和开发者打造的极简现代在线工具集合站",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      {/* ❌ 删除了手动写的 <head> */}
      <body className={`${inter.className} flex h-screen bg-slate-50/50 overflow-hidden`}>
        
        <Sidebar />

        <main className="flex-1 overflow-auto">
          <div className="h-full p-8 md:p-12 max-w-6xl mx-auto">
            {children}
          </div>
        </main>

      </body>
    </html>
  );
}