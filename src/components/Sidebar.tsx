// src/components/Sidebar.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toolsConfig } from "../config/tools";
import { openCommandPalette, toolsByHref, type SearchEntry } from "../config/search";
import { Home, Search, ChevronDown, ChevronRight, Clock3, Star } from "lucide-react";
import { SITE_NAME } from "@/config/site";
import { usePreferences } from "./PreferencesProvider";
import ThemeToggle from "./ThemeToggle";

interface SidebarProps {
  className?: string;
}

function QuickGroup({
  title, hrefs, icon: Icon,
}: {
  title: string;
  hrefs: string[];
  icon: React.ElementType;
}) {
  const pathname = usePathname();
  const items = hrefs
    .map((href) => toolsByHref.get(href))
    .filter((entry): entry is SearchEntry => Boolean(entry))
    .slice(0, 5);

  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </p>
      {items.map((entry) => {
        const ToolIcon = entry.icon;
        const isActive = pathname === entry.href;
        return (
          <Link
            key={entry.href}
            href={entry.href}
            className={`flex items-center px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium whitespace-nowrap ${
              isActive
                ? "bg-indigo-50 text-indigo-600"
                : "text-slate-600 hover:bg-slate-100/80 hover:text-indigo-600"
            }`}
          >
            <ToolIcon className="w-4 h-4 mr-3 shrink-0" />
            <span className="truncate">{entry.name}</span>
          </Link>
        );
      })}
    </div>
  );
}

export default function Sidebar({ className = "" }: SidebarProps) {
  const pathname = usePathname();
  const { recent, favorites, ready } = usePreferences();
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    toolsConfig.map((c) => c.category)
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  return (
    <aside className={`w-72 bg-white/80 backdrop-blur-xl border-r border-slate-200 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10 h-full ${className}`}>
      {/* Logo 区域 */}
      <div className="h-20 flex items-center px-6 border-b border-slate-100 shrink-0">
        <img src="/logo.png" alt={`${SITE_NAME} 标志`} className="w-10 h-10 rounded-lg mr-3 object-contain" />
        <span className="font-bold text-xl tracking-tight text-slate-800 whitespace-nowrap">{SITE_NAME}</span>
      </div>

      {/* 命令面板入口 */}
      <div className="p-4 border-b border-slate-100 shrink-0">
        <button
          type="button"
          onClick={openCommandPalette}
          className="w-full flex items-center gap-2 bg-slate-100/50 border border-slate-200 rounded-lg pl-3 pr-2 py-2 text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all text-left"
          aria-label="打开工具搜索"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">搜索工具或功能...</span>
          <kbd className="shrink-0 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-medium text-slate-500">Ctrl K</kbd>
        </button>
      </div>

      {/* 导航菜单区域 */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        <Link
          href="/"
          className={`flex items-center px-4 py-2.5 rounded-xl transition-all duration-200 group font-medium whitespace-nowrap ${
            pathname === "/" ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-100/80 hover:text-indigo-600"
          }`}
        >
          <Home className="w-5 h-5 mr-3 shrink-0" />
          首页控制台
        </Link>

        {ready && (
          <>
            <QuickGroup title="最近使用" hrefs={recent} icon={Clock3} />
            <QuickGroup title="我的收藏" hrefs={favorites} icon={Star} />
          </>
        )}

        {/* 动态渲染分类与工具 */}
        {toolsConfig.map((category) => {
          const isExpanded = expandedCategories.includes(category.category);
          return (
            <div key={category.category} className="space-y-1">
              <button
                onClick={() => toggleCategory(category.category)}
                aria-expanded={isExpanded}
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider hover:text-slate-600 transition-colors"
              >
                <div className="flex items-center min-w-0">
                  <category.icon className="w-3.5 h-3.5 mr-2 shrink-0" />
                  <span className="truncate">{category.category}</span>
                </div>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {isExpanded && (
                <div className="space-y-1 mt-1">
                  {category.tools.map((tool) => {
                    const isActive = pathname === tool.href;
                    return (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        className={`flex items-center px-4 py-2.5 rounded-xl transition-all duration-200 group text-sm font-medium whitespace-nowrap ${
                          isActive
                            ? "bg-indigo-50 text-indigo-600"
                            : "text-slate-600 hover:bg-slate-100/80 hover:text-indigo-600"
                        }`}
                      >
                        <tool.icon
                          className={`w-4 h-4 mr-3 shrink-0 ${
                            isActive ? "text-indigo-600" : "text-slate-500 group-hover:text-indigo-500"
                          }`}
                        />
                        <span className="truncate">{tool.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 外观与偏好 */}
      <div className="shrink-0 p-4 border-t border-slate-100 space-y-2">
        <ThemeToggle />
        <p className="text-xs text-slate-500 text-center">偏好与记录仅保存在本机</p>
      </div>
    </aside>
  );
}
