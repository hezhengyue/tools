// src/components/ToolShell.tsx
// 所有工具页共用的外壳模板：页面标题 → 内容卡 → 一行固定隐私说明。
// 视觉样式统一取自 globals.css 的 .ui-* 语义类。
// 隐私文案是全站固定句（local / server 两种），工具只在确有必要时用 footer.note 补一句；
// 工具的额外介绍请写在自己的页面里，不要塞进页脚。
"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toolsConfig, type ToolFooter, type ToolLayout } from "@/config/tools";
import { ChevronRight, Server, ShieldCheck, Star } from "lucide-react";
import { usePreferences } from "./PreferencesProvider";

interface ToolShellProps {
  children: ReactNode;
  extraContent?: ReactNode;
}

/** 布局原型 → globals.css 里的宽度类。原型在 config/tools.ts 里声明，页面不传宽度 */
const LAYOUT_CLASS: Record<ToolLayout, string> = {
  form: "ui-layout-form",
  table: "ui-layout-table",
  board: "ui-layout-board",
  wide: "ui-layout-wide",
};

/** 全站固定的一行隐私说明：格式一致、文案不随工具变化，note 才由工具自定义 */
function PrivacyLine({ footer }: { footer?: ToolFooter }) {
  const isServer = footer?.mode === "server";
  const Icon = isServer ? Server : ShieldCheck;
  return (
    <footer className="ui-privacy">
      <Icon className="ui-privacy-icon" aria-hidden="true" />
      <span>
        {isServer
          ? "归属地需由服务端接口查询，仅将你的公网 IP 发送给公共 IP 库，不收集或存储个人信息。"
          : "所有处理均在浏览器本地完成，数据不会上传到服务器。"}
      </span>
      {footer?.note && <span className="ui-privacy-note">{footer.note}</span>}
    </footer>
  );
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
        <div className="ui-panel ui-layout-form md:p-5">{children}</div>
        <PrivacyLine />
      </div>
    );
  }

  const currentTool = current.tool;
  const Icon = currentTool.icon;
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
      <div className="mb-4 md:mb-5">
        <div className="flex items-center space-x-3 md:space-x-4 mb-1.5 md:mb-2">
          <div className="w-10 h-10 md:w-11 md:h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
            <Icon size={20} strokeWidth={1.5} className="w-5 h-5" />
          </div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 break-words">
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

      {/* 内容卡片：宽度由 tools.ts 的 layout 原型决定，页面不做宽度判断 */}
      <div className={`ui-panel ${LAYOUT_CLASS[currentTool.layout ?? "form"]} md:p-5`}>
        {children}
      </div>

      {/* 底部说明：全站一行固定隐私句，不再重复工具介绍 */}
      <PrivacyLine footer={currentTool.footer} />

      {extraContent}
    </div>
  );
}
