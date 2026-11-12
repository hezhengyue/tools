"use client";

// src/components/ui/ToolUI.tsx
// 全站工具页的界面模板组件。视觉样式统一取自 globals.css 的 .ui-* 语义类，
// 新增工具页时请优先复用这里的结构，不要在页面里另写一套颜色/圆角/边框。
// 规范见 AGENTS.md「界面模板规范」。

import { useEffect, useRef, useState } from "react";
import type { ReactNode, ButtonHTMLAttributes, HTMLAttributes, ElementType } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
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
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
}) {
  const Icon = NOTICE_ICON[tone];
  return (
    <div
      className={`ui-notice ui-notice-${tone} ${className}`}
      role={tone === "error" ? "alert" : "status"}
      {...rest}
    >
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

/* ================================================================
   输出块：复制 / 下载的统一交互
   ----------------------------------------------------------------
   凡是「一段文本结果 + 复制 / 下载」，一律用 OutputBlock：
   标题行右侧放图标按钮，内容直接展示，操作按钮不再堆在结果下方。
   单独需要某个动作时用 CopyButton / DownloadButton。
   ================================================================ */

/** 统一的剪贴板写入：Clipboard API 失败（非 HTTPS / 权限被拒）时降级到 execCommand */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 继续走降级方案
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 复制图标按钮：内置剪贴板写入、失败兜底与「已复制」成功态 */
export function CopyButton({
  value,
  label = "复制",
  className = "",
  disabled = false,
  size = 16,
  onCopied,
}: {
  value: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  size?: number;
  onCopied?: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const handleCopy = async () => {
    if (!value || disabled) return;
    const ok = await writeClipboard(value);
    setStatus(ok ? "copied" : "failed");
    if (ok) onCopied?.();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 1500);
  };

  const title = status === "copied" ? "已复制" : status === "failed" ? "复制失败，请检查剪贴板权限" : label;
  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled || !value}
      title={title}
      aria-label={title}
      className={`ui-icon-btn ${status === "copied" ? "ui-icon-btn-success" : ""} ${
        status === "failed" ? "text-red-600 bg-red-50" : ""
      } ${className}`}
    >
      {status === "copied" ? <Check size={size} /> : status === "failed" ? <XCircle size={size} /> : <Copy size={size} />}
    </button>
  );
}

/** 下载图标按钮：把文本内容保存为指定文件名的文件 */
export function DownloadButton({
  value,
  filename,
  label,
  mimeType = "text/plain;charset=utf-8",
  className = "",
  disabled = false,
  size = 16,
}: {
  value: string;
  filename: string;
  label?: string;
  mimeType?: string;
  className?: string;
  disabled?: boolean;
  size?: number;
}) {
  const handleDownload = () => {
    if (!value || disabled) return;
    const url = URL.createObjectURL(new Blob([value], { type: mimeType }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const title = label ?? `下载 ${filename}`;
  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={disabled || !value}
      title={title}
      aria-label={title}
      className={`ui-icon-btn ${className}`}
    >
      <Download size={size} />
    </button>
  );
}

/**
 * 统一输出块：标题行（标签 + 说明）右侧是复制 / 下载图标按钮，下方是内容区。
 * 传 filename 即出现下载按钮；传 children 可自定义内容区（如代码块），复制仍取 value。
 */
export function OutputBlock({
  label,
  hint,
  value,
  filename,
  mimeType,
  copyLabel = "复制",
  tone = "default",
  placeholder,
  minHeight = "min-h-[120px]",
  textareaClassName = "",
  children,
  actions,
  className = "",
}: {
  label: ReactNode;
  hint?: ReactNode;
  value: string;
  filename?: string;
  mimeType?: string;
  copyLabel?: string;
  tone?: "default" | "warning";
  placeholder?: string;
  minHeight?: string;
  textareaClassName?: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const warning = tone === "warning";
  return (
    <div className={`ui-output ${className}`}>
      <div className="ui-output-head">
        <div className="ui-output-label-group">
          <span className={`ui-output-label ${warning ? "ui-output-label-warning" : ""}`}>
            {label}
          </span>
          {hint && <span className="ui-output-hint">{hint}</span>}
        </div>
        <div className="ui-output-actions">
          {actions}
          <CopyButton value={value} label={copyLabel} />
          {filename && (
            <DownloadButton value={value} filename={filename} mimeType={mimeType} />
          )}
        </div>
      </div>
      {children ?? (
        <textarea
          readOnly
          value={value}
          placeholder={placeholder}
          className={`ui-textarea ${minHeight} ${warning ? "ui-output-warning" : ""} ${textareaClassName}`}
        />
      )}
    </div>
  );
}
