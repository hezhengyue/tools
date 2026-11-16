// src/components/ui/OptionCard.tsx
// 图片工具的「开关型选项」卡片：图标 + 标题 + 一句说明 + 勾选框。
// 视觉来源是 /image-compress 的选项卡，全站图片工具统一用它，不要再写一套。

"use client";

import type { ElementType } from "react";
import { Lock } from "lucide-react";

export function OptionCard({
  checked, onChange, disabled, title, desc, icon: Icon, badge,
}: {
  checked: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  title: string;
  desc: string;
  icon: ElementType;
  badge?: string;
}) {
  const toggle = () => {
    if (!disabled) onChange?.(!checked);
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
        disabled
          ? "bg-slate-50 border-slate-200 cursor-not-allowed"
          : checked
            ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200 cursor-pointer"
            : "bg-white border-slate-200 hover:border-slate-400 cursor-pointer"
      }`}
      onClick={toggle}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          toggle();
        }
      }}
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-label={title}
      tabIndex={disabled ? -1 : 0}
    >
      <div className="relative mt-0.5">
        <div
          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
            disabled
              ? "bg-slate-100 border-slate-200"
              : checked
                ? "bg-indigo-600 border-indigo-600"
                : "border-slate-200 bg-white"
          }`}
        >
          {checked && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {disabled && <Lock size={12} className="text-slate-500" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon size={16} className={disabled ? "text-slate-500 opacity-50" : checked ? "text-indigo-600" : "text-slate-500"} />
          <span className={`font-medium ${disabled ? "text-slate-500" : checked ? "text-slate-800" : "text-slate-600"}`}>
            {title}
          </span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
