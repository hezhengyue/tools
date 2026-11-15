// src/components/ToolShell.tsx
// 所有工具页共用的外壳模板：页面标题 → 内容卡 → 统一页脚说明。
// 视觉样式统一取自 globals.css 的 .ui-* 语义类；页脚文案来自 config/tools.ts 的结构化数据。
"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toolsConfig, type ToolFooter } from "@/config/tools";
import { AlertCircle, ChevronRight, Star } from "lucide-react";
import { usePreferences } from "./PreferencesProvider";

interface ToolShellProps {
  children: ReactNode;
  extraContent?: ReactNode;
}

/** 按统一模板生成页脚主句：格式一致，内容按工具真实数据流区分 */
function FooterSentence({ footer }: { footer: ToolFooter }) {
  const emphasis = "font-semibold text-slate-800";
  if (footer.mode === "server") {
    return <>归属地由<strong className={emphasis}>服务端接口</strong>查询，仅将你的「{footer.subject}」发送给公共 IP 库。</>;
  }
  return <>所有处理在<strong className={emphasis}>浏览器本地完成</strong>，{footer.subject}不会上传到任何服务器。</>;
}

export default function ToolShell({ children, extraContent }: ToolShellProps) {
  const pathname = usePathname();
  const { favorites, toggleFavorite } = usePreferences();

  // 面包屑的分类从同一份清单派生，不需要页面再传一次
  const current = toolsConfig
    .flatMap((cat) => cat.tools.map((tool) => ({ tool, category: cat.category })))
    .find((item) => item.tool.href === pathname);

  if (!current) {
    return (
      <div className="w-full">
        <div className="ui-panel md:p-8">{children}</div>
      </div>
    );
  }

  const currentTool = current.tool;
  const Icon = currentTool.icon;
  const footer = currentTool.footer;
  const isFavorite = favorites.includes(currentTool.href);

  return (
    <div className="w-full opacity-100 transition-opacity duration-500">
      <nav aria-label="面包屑" className="ui-breadcrumb">
        <Link href="/">首页</Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{current.category}</span>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="ui-breadcrumb-current" aria-current="page">{currentTool.name}</span>
      </nav>

      {/* 头部：响应式排版 */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center space-x-3 md:space-x-4 mb-3 md:mb-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
            <Icon size={20} strokeWidth={1.5} className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 break-words">
            {currentTool.name}
          </h1>
          <button
            type="button"
            onClick={() => toggleFavorite(currentTool.href)}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `取消收藏 ${currentTool.name}` : `收藏 ${currentTool.name}`}
            title={isFavorite ? "取消收藏" : "收藏到侧栏"}
            className={`ml-auto shrink-0 p-2 rounded-xl border transition-colors ${
              isFavorite
                ? "border-amber-200 bg-amber-50 text-amber-600"
                : "border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
            }`}
          >
            <Star className="w-4 h-4 md:w-5 md:h-5" fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>
        <p className="ui-prose text-slate-500 text-sm md:text-base break-words">{currentTool.desc}</p>
      </div>

      {/* 内容卡片：移动端内边距减小 */}
      <div className="ui-panel md:p-8">{children}</div>

      {/* 底部说明：所有工具页格式统一（结构化渲染，不使用 innerHTML） */}
      {footer && (
        <div className="ui-footer">
          <AlertCircle className="ui-footer-icon" />
          <p className="min-w-0 leading-relaxed">
            <FooterSentence footer={footer} />
            {footer.extra && footer.extra}
          </p>
        </div>
      )}

      {extraContent}
    </div>
  );
}
