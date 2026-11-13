// app/regex/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Braces, Eraser, ListChecks, WandSparkles } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Badge, Notice, OutputBlock, Switch } from "@/components/ui/ToolUI";
import type { RegexMatch, RegexResponse } from "./regex.worker";

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
  const [result, setResult] = useState<RegexResponse | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let worker: Worker | null = null;
    let guard: ReturnType<typeof setTimeout> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const cleanup = () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (guard) clearTimeout(guard);
      worker?.terminate();
    };

    if (!pattern) {
      // 放到微任务里，避免在 effect 体内同步 setState 触发级联渲染
      queueMicrotask(() => {
        if (!cancelled) {
          setResult(null);
          setTimedOut(false);
        }
      });
      return cleanup;
    }

    // 输入防抖 + 独立线程 + 超时终止，三者一起杜绝灾难性回溯锁死页面
    timer = setTimeout(() => {
      setTimedOut(false);
      worker = new Worker(new URL("./regex.worker.ts", import.meta.url));

      guard = setTimeout(() => {
        worker?.terminate();
        if (!cancelled) {
          setResult(null);
          setTimedOut(true);
        }
      }, 1500);

      worker.onmessage = (event: MessageEvent<RegexResponse>) => {
        if (cancelled) return;
        if (guard) clearTimeout(guard);
        worker?.terminate();
        setResult(event.data);
      };
      worker.onerror = () => {
        if (cancelled) return;
        if (guard) clearTimeout(guard);
        worker?.terminate();
        setResult({ id: 0, ok: false, error: "匹配线程异常，请简化表达式后重试" });
      };
      worker.postMessage({ id: 0, pattern, flags, text, replacement });
    }, 220);

    return cleanup;
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
            className="ui-textarea min-h-[130px]"
          />
        </div>

        {okError && <Notice tone="error">表达式无效：{okError}</Notice>}
        {timedOut && (
          <Notice tone="error">
            匹配超过 1.5 秒已被强制中止。这通常是灾难性回溯，请简化嵌套量词（如 <code className="font-mono">(a+)+</code>）或缩短测试文本。
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

          <div className="ui-textarea min-h-[120px] whitespace-pre-wrap break-all font-mono text-sm leading-relaxed">
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
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
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
            minHeight="min-h-[110px]"
          />
        </div>

        <Notice tone="tip">
          匹配在独立线程中执行，卡住会自动终止；表达式使用 JavaScript 的 <code className="font-mono">RegExp</code> 语法，与 Python / PCRE 略有差异。
        </Notice>
      </div>
    </ToolShell>
  );
}
