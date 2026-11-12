// src/components/Sidebar.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toolsConfig } from "../config/tools";
import { Home, Search, ChevronDown, ChevronRight } from "lucide-react";
import { SITE_NAME } from "@/config/site";

interface SidebarProps {
  className?: string;
  /** 移动端从顶栏搜索按钮打开抽屉时自动聚焦搜索框 */
  autoFocusSearch?: boolean;
}

export default function Sidebar({ className = "", autoFocusSearch = false }: SidebarProps) {
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (autoFocusSearch) searchRef.current?.focus();
  }, [autoFocusSearch]);
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

      {/* 搜索框区域 */}
      <div className="p-4 border-b border-slate-100 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
          <input
            ref={searchRef}
            type="text"
            aria-label="搜索工具"
            placeholder="搜索工具或功能..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100/50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* 导航菜单区域 👇 确保 flex-1 + overflow-y-auto 生效 */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* 全部工具按钮 */}
        <Link
          href="/"
          className={`flex items-center px-4 py-2.5 rounded-xl transition-all duration-200 group font-medium whitespace-nowrap ${
            pathname === "/" ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-100/80 hover:text-indigo-600"
          }`}
        >
          <Home className="w-5 h-5 mr-3 shrink-0" />
          首页控制台
        </Link>

        {/* 动态渲染分类与工具 */}
        {toolsConfig.map((category) => {
          const q = searchQuery.trim().toLowerCase();
          const filteredTools = category.tools.filter((tool) =>
            !q || tool.name.toLowerCase().includes(q) || tool.desc.toLowerCase().includes(q)
          );

          if (filteredTools.length === 0) return null;

          const isExpanded = expandedCategories.includes(category.category);

          return (
            <div key={category.category} className="space-y-1">
              {/* 分类标题 */}
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

              {/* 工具列表 */}
              {isExpanded && (
                <div className="space-y-1 mt-1">
                  {filteredTools.map((tool) => {
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
    </aside>
  );
}