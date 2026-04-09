// src/components/MobileHeader.tsx
"use client";
import { useState } from "react";
import { Menu, X, Sparkles } from "lucide-react";
import Sidebar from "./Sidebar";
import Link from "next/link";

export default function MobileHeader() {
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <>
      {/* 顶部栏：仅移动端显示 */}
      <header className="md:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button 
          onClick={() => setShowSidebar(true)}
          className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors"
          aria-label="打开菜单"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
        
        <Link href="/" className="flex items-center">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-bold text-lg text-slate-800 ml-2 whitespace-nowrap">正月工具箱</span>
        </Link>
        
        {/* 占位按钮保持居中 */}
        <div className="w-9" />
      </header>

      {/* 移动端抽屉遮罩 + 侧边栏 */}
      {showSidebar && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* 遮罩层 */}
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowSidebar(false)}
          />
          
          {/* 侧边栏抽屉 */}
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl animate-in slide-in-from-left duration-300">
            <Sidebar />
          </div>
          
          {/* 关闭按钮 */}
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