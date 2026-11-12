"use client";

// src/app/json-format/page.tsx
// JSON 格式化 / 校验 / 树形浏览 / 转 TypeScript 接口。全部在浏览器本地完成。
// 解析使用原生 JSON.parse；错误信息里的 position 会被换算成行列号，方便定位。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Eraser,
  FileJson2,
  ListTree,
  Minimize2,
  Wand2,
} from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, Notice, OutputBlock, writeClipboard } from "@/components/ui/ToolUI";

/* ============================ 类型与常量 ============================ */

type Mode = "pretty" | "min" | "ts" | "tree";
type Indent = 2 | 4 | "tab";

interface ParseError {
  message: string;
  line: number;
  column: number;
}

interface ParseState {
  ok: boolean;
  value?: unknown;
  error?: ParseError;
  /** 输入为空时为 false，用来区分「空」和「解析失败」 */
  filled: boolean;
}

const MODES: { value: Mode; label: string; icon: typeof Braces }[] = [
  { value: "pretty", label: "格式化", icon: Braces },
  { value: "min", label: "压缩", icon: Minimize2 },
  { value: "ts", label: "TypeScript", icon: Code2 },
  { value: "tree", label: "树形", icon: ListTree },
];

const INDENTS: { value: Indent; label: string }[] = [
  { value: 2, label: "2 空格" },
  { value: 4, label: "4 空格" },
  { value: "tab", label: "Tab" },
];

const SAMPLE = `{
  "name": "正月工具箱",
  "version": "1.0.0",
  "tools": [
    { "name": "JSON 格式化", "path": "/json-format", "tags": ["json", "format"] },
    { "name": "时间戳转换", "path": "/timestamp", "tags": ["time"], "beta": true }
  ],
  "author": { "name": "hezhengyue", "site": "https://github.com/hezhengyue" }
}`;

/* ============================ 解析与错误定位 ============================ */

/**
 * 兜底定位器：V8 的报错有时只给一句 "Unexpected token '}'"，没有 position，
 * 这时用一个精简的递归下降扫描找出第一个出错的字符下标，保证行列号可用。
 * 只在 JSON.parse 失败后调用，因此不会影响正常解析结果。
 */
function locateError(text: string): { index: number; reason: string } | null {
  let i = 0;
  const n = text.length;

  function fail(index: number, reason: string): never {
    throw { index, reason };
  }

  const skipWs = () => {
    while (i < n && (text[i] === " " || text[i] === "\t" || text[i] === "\n" || text[i] === "\r")) i += 1;
  };

  const parseString = (): string => {
    i += 1;
    let out = "";
    for (;;) {
      if (i >= n) fail(i, "字符串没有闭合，缺少结尾的双引号");
      const c = text[i];
      if (c === '"') {
        i += 1;
        return out;
      }
      if (c === "\n") fail(i, "字符串里不能直接换行，需要写成 \\n");
      if (c === "\\") {
        const next = text[i + 1] ?? "";
        const map: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
        if (next in map) {
          out += map[next];
          i += 2;
          continue;
        }
        if (next === "u") {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail(i, "\\u 后面必须跟 4 位十六进制数");
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
        fail(i, `无效的转义字符「\\${next}」`);
      }
      out += c;
      i += 1;
    }
  };

  const parseNumber = (): number => {
    const match = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
    if (!match) fail(i, "数字格式不正确");
    i += match[0].length;
    return Number(match[0]);
  };

  const parseValue = (): unknown => {
    skipWs();
    if (i >= n) fail(i, "内容不完整，这里还缺一个值");
    const c = text[i];
    if (c === "{") return parseObject();
    if (c === "[") return parseArray();
    if (c === '"') return parseString();
    if (c === "-" || (c >= "0" && c <= "9")) return parseNumber();
    if (text.startsWith("true", i)) { i += 4; return true; }
    if (text.startsWith("false", i)) { i += 5; return false; }
    if (text.startsWith("null", i)) { i += 4; return null; }
    fail(i, `无法识别的字符「${c}」，JSON 只接受双引号字符串、数字、true/false/null、对象与数组`);
  };

  const parseObject = (): Record<string, unknown> => {
    i += 1;
    const obj: Record<string, unknown> = {};
    skipWs();
    if (text[i] === "}") { i += 1; return obj; }
    for (;;) {
      skipWs();
      if (text[i] === "}") fail(i, "多余的逗号：对象最后一项后面不能再跟逗号");
      if (text[i] !== '"') fail(i, "属性名必须用双引号包裹");
      const key = parseString();
      skipWs();
      if (text[i] !== ":") fail(i, "属性名后面缺少冒号");
      i += 1;
      obj[key] = parseValue();
      skipWs();
      if (text[i] === ",") { i += 1; continue; }
      if (text[i] === "}") { i += 1; return obj; }
      if (i >= n) fail(i, "对象没有闭合，缺少右花括号");
      fail(i, `这里缺少逗号或右花括号，却遇到了「${text[i]}」`);
    }
  };

  const parseArray = (): unknown[] => {
    i += 1;
    const arr: unknown[] = [];
    skipWs();
    if (text[i] === "]") { i += 1; return arr; }
    for (;;) {
      skipWs();
      if (text[i] === "]") fail(i, "多余的逗号：数组最后一项后面不能再跟逗号");
      arr.push(parseValue());
      skipWs();
      if (text[i] === ",") { i += 1; continue; }
      if (text[i] === "]") { i += 1; return arr; }
      if (i >= n) fail(i, "数组没有闭合，缺少右方括号");
      fail(i, `数组元素之间缺少逗号，却遇到了「${text[i]}」`);
    }
  };

  try {
    const value = parseValue();
    skipWs();
    if (i < n) fail(i, `根值已经结束，后面还有多余内容「${text[i]}」`);
    void value;
    return null; // 自己也能解析通过，说明报错来自更隐蔽的规则，交给 V8 原文
  } catch (err) {
    if (typeof err === "object" && err !== null && "index" in err && "reason" in err) {
      return err as { index: number; reason: string };
    }
    return null;
  }
}

function toLineColumn(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index);
  return { line: before.split("\n").length, column: index - before.lastIndexOf("\n") };
}

function parseJson(text: string): ParseState {
  if (!text.trim()) return { ok: false, filled: false };
  try {
    return { ok: true, value: JSON.parse(text) as unknown, filled: true };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "无法解析";
    // V8 的报错尾巴很长，去掉 "in JSON at position 12 (line 1 column 13)"
    const trimmed = raw.replace(/\s+in JSON at position[\s\S]*$/i, "");
    const posMatch = /position (\d+)/i.exec(raw);
    if (posMatch) {
      const { line, column } = toLineColumn(text, Number(posMatch[1]));
      return { ok: false, filled: true, error: { message: trimmed, line, column } };
    }
    const located = locateError(text);
    if (located) {
      const { line, column } = toLineColumn(text, located.index);
      return { ok: false, filled: true, error: { message: located.reason, line, column } };
    }
    return { ok: false, filled: true, error: { message: trimmed, line: 0, column: 0 } };
  }
}

/* ============================ 转 TypeScript ============================ */

interface Field {
  type: string;
  optional: boolean;
}

function pascal(input: string): string {
  const words = input
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "Item";
  const joined = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  return /^\d/.test(joined) ? `N${joined}` : joined;
}

function singular(word: string): string {
  if (/ies$/i.test(word)) return word.replace(/ies$/i, "y");
  if (/ses$/i.test(word)) return word.replace(/es$/i, "");
  if (/s$/i.test(word) && word.length > 3) return word.slice(0, -1);
  return word;
}

function safeKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function unionTypes(a: string, b: string): string {
  if (a === b) return a;
  const parts = a.split(" | ");
  if (parts.includes(b)) return a;
  return `${a} | ${b}`;
}

/** 递归推断类型；对象会被登记为 interface，同名对象自动合并 + 标记可选字段 */
function inferType(value: unknown, hint: string, out: Map<string, Map<string, Field>>): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    const base = singular(pascal(hint));
    const itemHint = base === pascal(hint) ? `${pascal(hint)}Item` : base;
    const types = new Set<string>();
    for (const item of value) types.add(inferType(item, itemHint, out));
    if (!types.size) return "unknown[]";
    const joined = [...types].join(" | ");
    return types.size === 1 ? `${joined}[]` : `(${joined})[]`;
  }
  if (typeof value === "object") {
    const name = pascal(hint);
    let fields = out.get(name);
    const isNewInterface = !fields;
    if (!fields) {
      fields = new Map<string, Field>();
      out.set(name, fields);
    }
    const current = new Map<string, string>();
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      current.set(key, inferType(item, key, out));
    }
    for (const key of fields.keys()) {
      if (!current.has(key)) fields.get(key)!.optional = true;
    }
    for (const [key, type] of current) {
      const prev = fields.get(key);
      // 新接口首次填充时字段都是必填；之后的合并里新增的字段才算可选
      if (!prev) fields.set(key, { type, optional: !isNewInterface });
      else if (prev.type !== type) prev.type = unionTypes(prev.type, type);
    }
    return name;
  }
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "unknown";
}

function generateTs(value: unknown, rootName: string): string {
  const out = new Map<string, Map<string, Field>>();
  const rootType = inferType(value, rootName, out);
  const blocks: string[] = [];
  for (const [name, fields] of out) {
    const lines = [`export interface ${name} {`];
    for (const [key, field] of fields) {
      lines.push(`  ${safeKey(key)}${field.optional ? "?" : ""}: ${field.type};`);
    }
    lines.push("}");
    blocks.push(lines.join("\n"));
  }
  const root = pascal(rootName);
  const alias = rootType === root ? "" : `export type ${root} = ${rootType};`;
  return [...blocks, alias].filter(Boolean).join("\n\n");
}

/* ============================ 树形视图 ============================ */

const VALUE_CLASS: Record<string, string> = {
  string: "text-emerald-600",
  number: "text-blue-600",
  boolean: "text-purple-600",
  null: "text-slate-400",
};

function previewOf(value: unknown): string {
  if (Array.isArray(value)) return `[ ${value.length} 项 ]`;
  if (value && typeof value === "object") {
    const count = Object.keys(value as Record<string, unknown>).length;
    return `{ ${count} 个键 }`;
  }
  return "";
}

function JsonNode({
  name,
  value,
  depth,
  isLast,
  onCopy,
}: {
  name?: string;
  value: unknown;
  depth: number;
  isLast: boolean;
  onCopy: (text: string) => void;
}) {
  // 默认展开前两层，深层折叠，避免大对象一屏塞满
  const [open, setOpen] = useState(depth < 2);
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === "object" && !isArray;
  const container = isArray || isObject;

  const label = name === undefined ? null : (
    <span className="text-slate-500 shrink-0">{name}:</span>
  );

  if (!container) {
    const type = value === null ? "null" : typeof value;
    const text = typeof value === "string" ? JSON.stringify(value) : String(value);
    return (
      <div className="flex items-baseline gap-1.5 py-[1px]">
        <span className="w-3 shrink-0" />
        {label}
        <button
          type="button"
          onClick={() => onCopy(text === "null" ? "null" : text.replace(/^"|"$/g, ""))}
          className={`text-left break-all hover:underline ${VALUE_CLASS[type] ?? "text-slate-700"}`}
          title="点击复制这个值"
        >
          {text}
        </button>
        {!isLast && <span className="text-slate-400">,</span>}
      </div>
    );
  }

  const entries: [string, unknown][] = isArray
    ? (value as unknown[]).map((item, index) => [String(index), item])
    : Object.entries(value as Record<string, unknown>);

  return (
    <div>
      <div className="flex items-baseline gap-1.5 py-[1px]">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label={open ? "折叠" : "展开"}
          className="w-3 shrink-0 text-slate-400 hover:text-indigo-600"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {label}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="text-slate-600 hover:text-indigo-600"
        >
          {previewOf(value)}
          {entries.length === 0 && (isArray ? "[]" : "{}")}
        </button>
        {!isLast && <span className="text-slate-400">,</span>}
      </div>
      {open && entries.length > 0 && (
        <div className="ml-1.5 pl-3 border-l border-slate-200">
          {entries.map(([key, item], index) => (
            <JsonNode
              key={key}
              name={isArray ? key : safeKey(key)}
              value={item}
              depth={depth + 1}
              isLast={index === entries.length - 1}
              onCopy={onCopy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ 页面 ============================ */

function JsonFormatCore() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("pretty");
  const [indent, setIndent] = useState<Indent>(2);
  const [rootName, setRootName] = useState("Root");
  const [parsed, setParsed] = useState<ParseState>({ ok: false, filled: false });
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 防抖解析：连续输入时不要每个字符都跑一遍 JSON.parse
  useEffect(() => {
    const timer = setTimeout(() => setParsed(parseJson(input)), 180);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  const output = useMemo(() => {
    if (!parsed.ok) return "";
    if (mode === "pretty") {
      return JSON.stringify(parsed.value, null, indent === "tab" ? "\t" : indent);
    }
    if (mode === "min") return JSON.stringify(parsed.value);
    if (mode === "ts") return generateTs(parsed.value, rootName || "Root");
    return "";
  }, [indent, mode, parsed, rootName]);

  const stats = useMemo(() => {
    const lines = input ? input.split("\n").length : 0;
    return { lines, chars: input.length };
  }, [input]);

  const summary = useMemo(() => {
    if (!parsed.ok) return "";
    const value = parsed.value;
    if (Array.isArray(value)) return `根类型 array · ${value.length} 项`;
    if (value && typeof value === "object") {
      return `根类型 object · ${Object.keys(value as Record<string, unknown>).length} 个键`;
    }
    return `根类型 ${value === null ? "null" : typeof value}`;
  }, [parsed]);

  const handleCopyTree = useCallback((text: string) => {
    void writeClipboard(text).then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1200);
    });
  }, []);

  const tidyInput = () => {
    if (!parsed.ok) return;
    setInput(JSON.stringify(parsed.value, null, indent === "tab" ? "\t" : indent));
  };

  return (
    <div className="space-y-5">
      {/* 输入区 */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <label htmlFor="json-source" className="ui-label text-sm">
            JSON 输入
          </label>
          <span className="text-xs text-slate-500">
            {stats.lines} 行 · {stats.chars} 字符
          </span>
        </div>
        <textarea
          id="json-source"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='粘贴 JSON，例如 {"name": "正月工具箱", "tools": 15}'
          spellCheck={false}
          autoComplete="off"
          className={`ui-textarea font-mono min-h-[220px] ${
            parsed.filled && !parsed.ok ? "border-red-300" : ""
          }`}
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button
            variant="secondary"
            size="sm"
            icon={Wand2}
            onClick={tidyInput}
            disabled={!parsed.ok}
          >
            整理缩进
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={FileJson2}
            onClick={() => setInput(SAMPLE)}
          >
            载入示例
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Eraser}
            onClick={() => setInput("")}
            disabled={!input}
          >
            清空
          </Button>
          {parsed.ok && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Check size={14} /> 合法 JSON · {summary}
            </span>
          )}
        </div>
      </div>

      {/* 错误定位 */}
      {parsed.filled && parsed.error && (
        <Notice tone="error">
          {parsed.error.line > 0 ? (
            <>
              第 <b>{parsed.error.line}</b> 行第 <b>{parsed.error.column}</b> 列附近：
            </>
          ) : (
            <>语法错误：</>
          )}
          {parsed.error.message}
        </Notice>
      )}

      {/* 输出模式 */}
      {parsed.ok && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="ui-label text-sm">输出形式</span>
              {mode === "tree" && (
                <span className="text-xs text-slate-500">
                  {copied ? "已复制该值" : "点击值可复制，点击括号可折叠"}
                </span>
              )}
            </div>
            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl"
              role="tablist"
              aria-label="输出形式"
            >
              {MODES.map(({ value, label, icon: Icon }) => {
                const active = mode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMode(value)}
                    className={`flex items-center justify-center gap-1.5 py-1.5 text-sm rounded-lg transition-all ${
                      active
                        ? "bg-white text-indigo-600 font-semibold shadow-sm"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {mode === "pretty" && (
            <div>
              <span className="ui-label text-sm block mb-2">缩进</span>
              <div className="flex gap-2">
                {INDENTS.map(({ value, label }) => (
                  <button
                    key={String(value)}
                    type="button"
                    aria-pressed={indent === value}
                    onClick={() => setIndent(value)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                      indent === value
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "ts" && (
            <div>
              <label htmlFor="root-name" className="ui-label text-sm block mb-2">
                根接口名
              </label>
              <input
                id="root-name"
                value={rootName}
                onChange={(e) => setRootName(e.target.value)}
                maxLength={40}
                spellCheck={false}
                className="ui-input font-mono max-w-[240px]"
                placeholder="Root"
              />
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                嵌套对象会各自生成 interface；同名对象自动合并，只在部分元素里出现的字段标记为可选（<span className="font-mono">?</span>）。
              </p>
            </div>
          )}

          {mode === "tree" ? (
            <div className="ui-output">
              <div className="ui-output-head">
                <div className="ui-output-label-group">
                  <span className="ui-output-label">树形视图</span>
                  <span className="ui-output-hint">只读</span>
                </div>
              </div>
              <div className="p-4 overflow-auto max-h-[480px] font-mono text-[13px] leading-6">
                <JsonNode value={parsed.value} depth={0} isLast onCopy={handleCopyTree} />
              </div>
            </div>
          ) : (
            <OutputBlock
              label={mode === "ts" ? "TypeScript" : "格式化结果"}
              hint={mode === "min" ? "已去除所有空格与换行" : undefined}
              value={output}
              filename={mode === "ts" ? "types.ts" : mode === "min" ? "data.min.json" : "data.json"}
              mimeType={mode === "ts" ? "text/plain;charset=utf-8" : "application/json;charset=utf-8"}
              minHeight="min-h-[260px]"
            />
          )}
        </div>
      )}

      {!parsed.filled && (
        <Notice tone="tip">
          粘贴或输入 JSON 后自动校验并转换。<b>键名重复、尾随逗号、单引号</b>是三种最常见的错误，错误提示会直接指出行号和列号。需要反向转换（JSON → YAML）请用
          「JSON 转 YAML」。
        </Notice>
      )}
    </div>
  );
}

export default function JsonFormatPage() {
  return (
    <ToolShell>
      <JsonFormatCore />
    </ToolShell>
  );
}
