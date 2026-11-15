// src/components/HomeCategories.tsx
// 首页分类清单：可折叠，折叠状态与侧栏共用 PreferencesProvider 的统一 hook。
"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { toolsConfig } from "@/config/tools";
import { useCategoryExpansion } from "./PreferencesProvider";

const ALL_CATEGORIES = toolsConfig.map((group) => group.category);

export default function HomeCategories() {
  // 首页默认全展开；侧栏默认只展开当前分类，两者共享用户手动折叠的结果
  const { expanded, toggle } = useCategoryExpansion("home", ALL_CATEGORIES);

  return (
    <div className="space-y-8 md:space-y-10">
      {toolsConfig.map((category, index) => {
        const isExpanded = expanded.includes(category.category);
        return (
          <section key={category.category} id={`category-${index}`} aria-label={category.category}>
            <h2 className="flex items-center mb-4 md:mb-5 text-lg md:text-xl font-bold text-slate-800">
              <button
                type="button"
                onClick={() => toggle(category.category)}
                aria-expanded={isExpanded}
                aria-controls={`category-grid-${index}`}
                className="group flex w-full items-center gap-3 text-left"
              >
                <span className="w-1.5 h-5 md:h-6 bg-indigo-500 rounded-full shrink-0" aria-hidden="true" />
                <span>{category.category}</span>
                <span className="text-xs font-normal text-slate-500">{category.tools.length} 个工具</span>
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-indigo-600" aria-hidden="true" />
                  : <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-600" aria-hidden="true" />}
              </button>
            </h2>

            {/* 网格常驻 DOM，折叠时只隐藏，保证 aria-controls 始终有目标 */}
            <div
              id={`category-grid-${index}`}
              className={isExpanded ? "ui-card-grid" : "ui-card-grid hidden"}
            >
                {category.tools.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="group block p-5 md:p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 md:p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="text-slate-500 group-hover:text-indigo-500 transition-colors w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 md:mb-6 shadow-inner">
                      <tool.icon size={24} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-base md:text-lg font-bold mb-1 md:mb-2 text-slate-800 break-words">
                      {tool.name}
                    </h3>
                    <p className="text-slate-500 leading-relaxed text-sm line-clamp-2 break-words">
                      {tool.desc}
                    </p>
                  </Link>
                ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
