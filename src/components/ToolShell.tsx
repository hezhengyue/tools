// components/ToolShell.tsx
"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { toolsConfig } from "@/config/tools";
import { AlertCircle } from "lucide-react";

interface ToolShellProps {
  children: ReactNode;
  /** 是否显示底部说明（默认 true） */
  showFooter?: boolean;
  /** 自定义额外内容（可选） */
  extraContent?: ReactNode;
}

export default function ToolShell({ 
  children, 
  showFooter = true,
  extraContent 
}: ToolShellProps) {
  const pathname = usePathname();
  
  // 根据当前路径匹配工具配置
  const currentTool = toolsConfig
    .flatMap((cat) => cat.tools)
    .find((tool) => tool.href === pathname);

  // 未找到配置时降级渲染
  if (!currentTool) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white p-8 rounded-3xl border border-slate-200/60 shadow-sm">
          {children}
        </div>
      </div>
    );
  }

  const Icon = currentTool.icon;

  return (
    <div className="max-w-4xl mx-auto opacity-100 transition-opacity duration-500">
      {/* 统一头部 */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
            <Icon size={24} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {currentTool.name}
          </h1>
        </div>
        <p className="text-slate-500">{currentTool.desc}</p>
      </div>

      {/* 统一内容卡片 */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200/60 shadow-sm">
        {children}
      </div>

      {/* 统一底部说明（可配置显示/隐藏） */}
      {showFooter && currentTool.footerNote && (
        <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
            <div dangerouslySetInnerHTML={{ __html: currentTool.footerNote }} />
          </div>
        </div>
      )}

      {/* 自定义额外内容 */}
      {extraContent}
    </div>
  );
}