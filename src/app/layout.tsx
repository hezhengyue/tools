import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "../components/Sidebar"; // 引入刚才写的组件

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "正月工具箱",
  description: "为小白和开发者打造的极简现代在线工具集合站",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.className} flex h-screen bg-slate-50/50 overflow-hidden`}>
        
        {/* 左侧独立出去的动态导航栏 */}
        <Sidebar />

        {/* 右侧动态内容区 */}
        <main className="flex-1 overflow-auto bg-[url('https://grainy-gradients.vercel.app/noise.svg')]">
          <div className="h-full p-8 md:p-12 max-w-6xl mx-auto">
            {children}
          </div>
        </main>

      </body>
    </html>
  );
}