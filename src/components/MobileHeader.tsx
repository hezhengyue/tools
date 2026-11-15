// src/components/MobileHeader.tsx
// 移动端顶栏 + 导航抽屉。抽屉按模态对话框处理：Esc 关闭、焦点循环、
// 背景滚动锁定；点抽屉内任意工具链接或打开命令面板后自动关闭。
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Search } from "lucide-react";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import Link from "next/link";
import { SITE_NAME } from "@/config/site";
import { openCommandPalette, toolsByHref } from "@/config/search";
import { trapTabFocus } from "./ui/focus";

export default function MobileHeader() {
  const pathname = usePathname();
  const [showSidebar, setShowSidebar] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const currentName = toolsByHref.get(pathname)?.name ?? SITE_NAME;

  /** 被命令面板顶掉时只收起抽屉，不抢回焦点（由面板接管） */
  const dismissDrawer = useCallback(() => setShowSidebar(false), []);
  const closeDrawer = useCallback(() => {
    setShowSidebar(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }, []);

  // 命令面板与抽屉都是 aria-modal，同时存在会互相劫持 Tab / Esc。
  // 所有打开面板的入口最终都派发 tools:open-search，这里统一让位。
  useEffect(() => {
    window.addEventListener("tools:open-search", dismissDrawer);
    return () => window.removeEventListener("tools:open-search", dismissDrawer);
  }, [dismissDrawer]);

  useEffect(() => {
    if (!showSidebar) return;

    // 主内容区是独立的滚动容器，锁定它才能防止滚轮穿透遮罩
    const scroller = document.querySelector("main");
    const previousOverflow = scroller?.style.overflow;
    if (scroller) scroller.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      trapTabFocus(event, drawerRef.current);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (scroller) scroller.style.overflow = previousOverflow ?? "";
    };
  }, [showSidebar, closeDrawer]);

  return (
    <>
      {/* 顶部栏：仅移动端显示 */}
      <header className="md:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-2">
        <button
          ref={triggerRef}
          onClick={() => setShowSidebar(true)}
          className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
          aria-label="打开菜单"
          aria-expanded={showSidebar}
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>

        <Link href="/" className="flex items-center min-w-0" title={SITE_NAME}>
          <img src="/logo.png" alt={`${SITE_NAME} 标志`} className="w-8 h-8 rounded-lg object-contain shrink-0" />
          <span className="font-bold text-lg text-slate-800 ml-2 whitespace-nowrap truncate">{currentName}</span>
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
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="导航菜单"
          onClickCapture={(event) => {
            const target = event.target as Element;
            if (target.closest?.("a[href]")) closeDrawer();
          }}
          className="md:hidden fixed inset-0 z-50"
        >
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 h-full bg-white shadow-2xl animate-in slide-in-from-left duration-300 overflow-y-auto custom-scrollbar">
            <Sidebar className="h-full" />
          </div>
          <button
            ref={closeBtnRef}
            onClick={closeDrawer}
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
