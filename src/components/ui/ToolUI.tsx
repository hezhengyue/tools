// src/components/ui/ToolUI.tsx
// 全站工具页的界面模板组件。视觉样式统一取自 globals.css 的 .ui-* 语义类，
// 新增工具页时请优先复用这里的结构，不要在页面里另写一套颜色/圆角/边框。
// 规范见 AGENTS.md「界面模板规范」。

import type { ReactNode, ButtonHTMLAttributes, HTMLAttributes, ElementType } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Lightbulb,
  XCircle,
} from "lucide-react";

type IconType = ElementType<{ className?: string; size?: number; strokeWidth?: number }>;

/** 内容区块：带图标标题的白色卡片 */
export function Panel({
  icon: Icon,
  title,
  children,
  className = "",
}: {
  icon?: IconType;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ui-panel ${className}`}>
      <h3 className="ui-panel-title">
        {Icon && <Icon className="ui-panel-icon" size={20} strokeWidth={1.75} />}
        {title}
      </h3>
      {children}
    </section>
  );
}

/** 键值信息行 */
export function KeyRow({
  label,
  value,
  mono = false,
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={`ui-kv ${className}`}>
      <span className="ui-kv-label">{label}</span>
      <span className={`ui-kv-value ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

/** 大号结果展示区（如公网 IP、生成的密码） */
export function DisplayBox({
  label,
  value,
  children,
  className = "",
}: {
  label?: ReactNode;
  value?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ui-display ${className}`}>
      {label && <div className="text-slate-500 text-sm mb-2">{label}</div>}
      {value !== undefined && (
        <div className="text-3xl md:text-4xl font-mono font-bold text-slate-800 break-all">
          {value}
        </div>
      )}
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** 统一按钮 */
export function Button({
  variant = "primary",
  size = "md",
  block = false,
  icon: Icon,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  block?: boolean;
  icon?: IconType;
}) {
  return (
    <button
      className={`ui-btn ui-btn-${variant} ${size === "sm" ? "ui-btn-sm" : ""} ${
        block ? "ui-btn-block" : ""
      } ${className}`}
      {...rest}
    >
      {Icon && <Icon size={18} strokeWidth={1.75} />}
      {children}
    </button>
  );
}

/** 统一图标按钮（复制、删除、撤销等） */
export function IconButton({
  label,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button className={`ui-icon-btn ${className}`} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

type NoticeTone = "tip" | "info" | "success" | "error";

const NOTICE_ICON: Record<NoticeTone, IconType> = {
  tip: Lightbulb,
  info: Info,
  success: CheckCircle2,
  error: XCircle,
};

/** 统一提示条 */
export function Notice({
  tone = "info",
  children,
  className = "",
}: {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
}) {
  const Icon = NOTICE_ICON[tone];
  return (
    <div className={`ui-notice ui-notice-${tone} ${className}`}>
      <Icon size={16} className="shrink-0 mt-0.5" strokeWidth={1.75} />
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  );
}

/** 统一空状态 */
export function EmptyState({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`ui-empty ${className}`}>{children}</div>;
}

/** 统一表单字段：标签 + 右侧补充说明 + 控件 */
export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3 gap-3">
        <label className="ui-label text-sm">{label}</label>
        {hint}
      </div>
      {children}
    </div>
  );
}

/** 统一按钮组（两列或自适应） */
export function ToolActions({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`grid grid-cols-2 gap-4 ${className}`}>{children}</div>;
}

/** 统一徽章 */
export function Badge({
  children,
  className = "",
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`ui-badge ${className}`} {...rest}>
      {children}
    </span>
  );
}

/** 页脚说明里的警示图标（供 ToolShell 使用） */
export const FooterIcon = AlertCircle;
