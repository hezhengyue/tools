// src/components/ToolShell.tsx
"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { toolsConfig } from "@/config/tools";
import { AlertCircle } from "lucide-react";

interface ToolShellProps {
  children: ReactNode;
  showFooter?: boolean;
  extraContent?: ReactNode;
}

export default function ToolShell({ 
  children, 
  showFooter = true,
  extraContent 
}: ToolShellProps) {
  const pathname = usePathname();
  
  const currentTool = toolsConfig
    .flatMap((cat) => cat.tools)
    .find((tool) => tool.href === pathname);

  if (!currentTool) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/60 shadow-sm">
          {children}
        </div>
      </div>
    );
  }

  const Icon = currentTool.icon;

  return (
    <div className="max-w-4xl mx-auto opacity-100 transition-opacity duration-500">
      {/* 头部：响应式排版 */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center space-x-3 md:space-x-4 mb-3 md:mb-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
            <Icon size={20} strokeWidth={1.5} className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 break-words">
            {currentTool.name}
          </h1>
        </div>
        <p className="text-slate-500 text-sm md:text-base break-words">{currentTool.desc}</p>
      </div>

      {/* 内容卡片：移动端内边距减小 */}
      <div className="bg-white p-5 md:p-8 rounded-3xl border border-slate-200/60 shadow-sm">
        {children}
      </div>

      {/* 底部说明 */}
      {showFooter && currentTool.footerNote && (
        <div className="mt-6 md:mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
            <div 
              className="break-words"
              dangerouslySetInnerHTML={{ __html: currentTool.footerNote }} 
            />
          </div>
        </div>
      )}

      {extraContent}
    </div>
  );
}