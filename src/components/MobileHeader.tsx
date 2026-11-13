// src/components/MobileHeader.tsx
"use client";
import { useState } from "react";
import { Menu, X, Search } from "lucide-react";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import Link from "next/link";
import { SITE_NAME } from "@/config/site";
import { openCommandPalette } from "@/config/search";

export default function MobileHeader() {
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <>
      {/* 顶部栏：仅移动端显示 */}
      <header className="md:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-2">
        <button
          onClick={() => setShowSidebar(true)}
          className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
          aria-label="打开菜单"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>

        <Link href="/" className="flex items-center min-w-0">
          <img src="/logo.png" alt={`${SITE_NAME} 标志`} className="w-8 h-8 rounded-lg object-contain shrink-0" />
          <span className="font-bold text-lg text-slate-800 ml-2 whitespace-nowrap truncate">{SITE_NAME}</span>
        </Link>

        <div className="flex items-center shrink-0 -mr-2">
          <button
            onClick={openCommandPalette}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
            aria-label="搜索工具"
          >
            <Search className="w-5 h-5 text-slate-700" />
          </button>
          <ThemeToggle compact />
        </div>
      </header>

      {/* 移动端抽屉遮罩 + 侧边栏 */}
      {showSidebar && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowSidebar(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 h-full bg-white shadow-2xl animate-in slide-in-from-left duration-300 overflow-y-auto custom-scrollbar">
            <Sidebar className="h-full" />
          </div>
          <button
            onClick={() => setShowSidebar(false)}
            className="absolute top-4 right-4 z-50 p-2 bg-white rounded-full shadow-lg hover:bg-slate-50 transition-colors"
            aria-label="关闭菜单"
          >
            <X className="w-5 h-5 text-slate-700" />
          </button>
        </div>
      )}
    </>
  );
}
