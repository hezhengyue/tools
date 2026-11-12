// src/components/MobileHeader.tsx
"use client";
import { useState } from "react";
import { Menu, X, Search } from "lucide-react";
import Sidebar from "./Sidebar";
import Link from "next/link";
import { SITE_NAME } from "@/config/site";

export default function MobileHeader() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [focusSearch, setFocusSearch] = useState(false);

  const open = (withSearch: boolean) => {
    setFocusSearch(withSearch);
    setShowSidebar(true);
  };

  const close = () => {
    setShowSidebar(false);
    setFocusSearch(false);
  };

  return (
    <>
      {/* 顶部栏：仅移动端显示 */}
      <header className="md:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => open(false)}
          className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors"
          aria-label="打开菜单"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
        
        <Link href="/" className="flex items-center">
          <img src="/logo.png" alt={`${SITE_NAME} 标志`} className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-bold text-lg text-slate-800 ml-2 whitespace-nowrap">{SITE_NAME}</span>
        </Link>
        
        {/* 移动端搜索入口：打开抽屉并聚焦侧栏搜索框 */}
        <button
          onClick={() => open(true)}
          className="p-2 -mr-2 rounded-xl hover:bg-slate-100 transition-colors"
          aria-label="搜索工具"
        >
          <Search className="w-5 h-5 text-slate-700" />
        </button>
      </header>

      {/* 移动端抽屉遮罩 + 侧边栏 */}
      {showSidebar && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* 遮罩层 */}
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={close}
          />
          
          {/* 侧边栏抽屉 👇 关键修复：添加 h-full overflow-y-auto */}
          <div className="absolute left-0 top-0 bottom-0 w-72 h-full bg-white shadow-2xl animate-in slide-in-from-left duration-300 overflow-y-auto custom-scrollbar">
            <Sidebar className="h-full" autoFocusSearch={focusSearch} />
          </div>
          
          {/* 关闭按钮 */}
          <button
            onClick={close}
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