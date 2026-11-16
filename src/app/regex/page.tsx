// app/regex/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Braces, Eraser, ListChecks, WandSparkles } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Badge, Notice, OutputBlock, Switch } from "@/components/ui/ToolUI";
import { runRegex, type RegexMatch, type RegexResult } from "./regex";

const DEFAULT_PATTERN = "(\\d{4})-(\\d{2})-(\\d{2})";
const DEFAULT_TEXT =
  "发版日期 2026-11-13，备份日期 2026-10-01。\n联系人邮箱 hello@example.com，电话 13800138000。";

const FLAGS: { value: string; label: string; desc: string }[] = [
  { value: "g", label: "g", desc: "全局匹配" },
  { value: "i", label: "i", desc: "忽略大小写" },
  { value: "m", label: "m", desc: "多行 ^$" },
  { value: "s", label: "s", desc: ". 匹配换行" },
  { value: "u", label: "u", desc: "Unicode" },
  { value: "y", label: "y", desc: "粘连匹配" },
];

const PRESETS: { label: string; pattern: string; flags: string }[] = [
  { label: "邮箱", pattern: "[\\w.+-]+@[\\w-]+\\.[\\w.-]+", flags: "g" },
  { label: "手机号", pattern: "1[3-9]\\d{9}", flags: "g" },
  { label: "网址", pattern: "https?://[^\\s]+", flags: "g" },
  { label: "IPv4", pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b", flags: "g" },
  { label: "日期", pattern: "(\\d{4})-(\\d{2})-(\\d{2})", flags: "g" },
  { label: "中文", pattern: "[\\u4e00-\\u9fa5]+", flags: "g" },
  { label: "HTML 标签", pattern: "<\\/?([a-z][\\w-]*)(?:\\s[^>]*)?>", flags: "gi" },
  { label: "整数", pattern: "-?\\b\\d+\\b", flags: "g" },
];

/** 把匹配结果切成「普通文本 / 高亮文本」片段，零宽与区间重叠的匹配跳过 */
function buildSegments(text: string, matches: RegexMatch[]) {
  const parts: { text: string; hit: boolean }[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (!match.value.length || match.index < cursor || match.index > text.length) continue;
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index), hit: false });
    parts.push({ text: match.value, hit: true });
    cursor = match.index + match.value.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}

function describeGroup(value: string | undefined) {
  return value === undefined ? "undefined" : `「${value}」`;
}

export default function RegexPage() {
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const [flags, setFlags] = useState("g");
  const [text, setText] = useState(DEFAULT_TEXT);
  const [replacement, setReplacement] = useState("$1/$2/$3");
  const [result, setResult] = useState<RegexResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    // 依赖一变就作废旧结果：否则防抖期间会用「新 text」配「旧 matches」的
    // index/value 切片，高亮整体错位，替换结果与命中数也是上一段文本的。
    queueMicrotask(() => {
      if (!cancelled) setResult(null);
    });

    if (!pattern) return () => { cancelled = true; };

    // 防抖之后同步计算：纯 JS 匹配在几十毫秒内完成，不需要跨线程来回搬运文本
    const timer = setTimeout(() => {
      if (!cancelled) setResult(runRegex(pattern, flags, text, replacement));
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pattern, flags, text, replacement]);

  const toggleFlag = (flag: string) => {
    setFlags((prev) => {
      const set = new Set(prev.split(""));
      if (set.has(flag)) set.delete(flag);
      else set.add(flag);
      return FLAGS.map((item) => item.value).filter((item) => set.has(item)).join("");
    });
  };

  const segments = useMemo(
    () => (result && result.ok ? buildSegments(text, result.matches) : []),
    [result, text]
  );
  const replaced = result && result.ok ? result.replaced : "";
  const matchCount = result && result.ok ? result.matches.length : 0;
  const okError = result && !result.ok ? result.error : "";
  const budgetHit = Boolean(result?.ok && result.budgetHit);

  return (
    <ToolShell>
      <div className="space-y-6">
        {/* 表达式与修饰符 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="regex-pattern" className="ui-label text-sm">正则表达式</label>
            <span className="text-xs text-slate-500 font-mono break-all">/{pattern}/{flags}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-mono text-lg shrink-0">/</span>
            <input
              id="regex-pattern"
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              spellCheck={false}
              placeholder="在此输入表达式，例如 (\d{4})-(\d{2})-(\d{2})"
              className="ui-input font-mono text-sm"
            />
            <span className="text-slate-500 font-mono text-lg shrink-0">/</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {FLAGS.map((flag) => (
              <Switch
                key={flag.value}
                id={`regex-flag-${flag.value}`}
                checked={flags.includes(flag.value)}
                onChange={() => toggleFlag(flag.value)}
                label={<span className="font-mono">{flag.label}</span>}
                hint={flag.desc}
              />
            ))}
          </div>
        </div>

        {/* 常用表达式 */}
        <div className="space-y-3">
          <span className="ui-label text-sm flex items-center gap-2">
            <WandSparkles size={16} className="text-indigo-600" /> 常用表达式
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setPattern(preset.pattern);
                  setFlags(preset.flags);
                }}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setPattern(""); setText(""); setReplacement(""); }}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:border-red-200 transition-colors"
            >
              <Eraser size={14} className="inline mr-1" />清空
            </button>
          </div>
        </div>

        {/* 测试文本 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="regex-text" className="ui-label text-sm">测试文本</label>
            <span className="text-xs text-slate-500">{text.length} 字符</span>
          </div>
          <textarea
            id="regex-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            placeholder="粘贴要匹配的文本…"
            className="ui-textarea ui-editor"
          />
        </div>

        {okError && <Notice tone="error">{okError}</Notice>}
        {budgetHit && (
          <Notice tone="tip">
            匹配已跑满 2 秒，只返回前 {matchCount.toLocaleString()} 处结果。表达式或文本过于复杂，建议缩小测试范围。
          </Notice>
        )}

        {/* 匹配结果 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="ui-label text-sm flex items-center gap-2">
              <ListChecks size={16} className="text-indigo-600" /> 匹配结果
            </span>
            {result?.ok && (
              <div className="flex items-center gap-2">
                <Badge className={matchCount ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}>
                  {matchCount ? `命中 ${matchCount} 处` : "无匹配"}
                </Badge>
                {result.truncated && <Badge className="bg-amber-50 text-amber-700">仅显示前 1000 处</Badge>}
              </div>
            )}
          </div>

          <div className="ui-textarea ui-viewer whitespace-pre-wrap break-all font-mono text-sm leading-relaxed">
            {segments.length ? (
              segments.map((part, index) =>
                part.hit ? (
                  <mark key={index} className="bg-indigo-100 text-indigo-800 rounded px-0.5">
                    {part.text}
                  </mark>
                ) : (
                  <span key={index}>{part.text}</span>
                )
              )
            ) : (
              <span className="text-slate-500">输入表达式与测试文本后，命中内容会在这里高亮。</span>
            )}
          </div>

          {result?.ok && result.matches.length > 0 && (
            <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
              {result.matches.slice(0, 200).map((match, index) => (
                <div key={`${match.index}-${index}`} className="px-3 py-2 text-sm flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-slate-500 font-mono text-xs shrink-0">#{index + 1} @ {match.index}</span>
                  <span className="font-mono text-slate-800 break-all">{match.value || "（零宽匹配）"}</span>
                  {match.groups.length > 0 && (
                    <span className="text-slate-500 text-xs break-all">
                      分组：{match.groups.map((group, i) => `$${i + 1}=${describeGroup(group)}`).join("  ")}
                    </span>
                  )}
                  {match.named && (
                    <span className="text-slate-500 text-xs break-all">
                      具名：{Object.entries(match.named).map(([key, value]) => `${key}=${describeGroup(value)}`).join("  ")}
                    </span>
                  )}
                </div>
              ))}
              {result.matches.length > 200 && (
                <div className="px-3 py-2 text-xs text-slate-500">列表仅展示前 200 条，替换仍使用全部结果。</div>
              )}
            </div>
          )}
        </div>

        {/* 替换预览 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="regex-replacement" className="ui-label text-sm flex items-center gap-2">
              <Braces size={16} className="text-indigo-600" /> 替换模板
            </label>
            <span className="text-xs text-slate-500">支持 $1 / $&lt;name&gt; / $$</span>
          </div>
          <input
            id="regex-replacement"
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            spellCheck={false}
            placeholder="留空即为删除匹配内容"
            className="ui-input font-mono text-sm"
          />
          <OutputBlock
            label="替换结果"
            hint="按当前修饰符应用 String.replace"
            value={replaced}
            copyLabel="复制替换结果"
            filename="regex-replaced.txt"
            placeholder="替换后的文本会出现在这里…"
          />
        </div>

        <p className="ui-note">
          语法为 JavaScript 的 <code className="font-mono">RegExp</code>，与 Python / PCRE 略有差异；含嵌套量词（如 <code className="font-mono">(a+)+</code>）的表达式会被提前拒绝，避免页面假死。
        </p>
      </div>
    </ToolShell>
  );
}
