// app/json-yaml/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import yaml from "js-yaml";
import { AlertCircle, Check } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Notice, CopyButton, Segmented } from "@/components/ui/ToolUI";

type Direction = "json2yaml" | "yaml2json";

const DIRECTION_OPTIONS: { value: Direction; label: string }[] = [
  { value: "json2yaml", label: "JSON → YAML" },
  { value: "yaml2json", label: "YAML → JSON" },
];

// ============ 核心功能组件（只写业务逻辑） ============

/**
 * 扫描 JSON 文本中「超出 Number.MAX_SAFE_INTEGER 的整数字面量」。
 * JSON.parse 会把它们静默舍入（9007199254740993 → 9007199254740992），
 * 转换工具必须明确报错，而不是给出看似成功、实则改坏了 ID / 金额的结果。
 */
function findUnsafeInteger(text: string): number | null {
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      const match = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));
      if (!match) continue;
      const token = match[0];
      if (!/[.eE]/.test(token) && !Number.isSafeInteger(Number(token))) return i;
      i += token.length - 1;
    }
  }
  return null;
}

/**
 * YAML 反向转换也有同样的精度问题：js-yaml 把整数解析成 JS number，
 * 超过 2^53 的值同样会被静默改写。这里跳过引号内的字符串与 # 注释，
 * 只检查真正会被当成数字的整数令牌。
 */
function findUnsafeYamlInteger(text: string): number | null {
  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (ch === "#") {
      const breakAt = text.indexOf("\n", i);
      i = breakAt === -1 ? text.length : breakAt + 1;
      continue;
    }

    // 单引号标量：内部 '' 表示一个引号
    if (ch === "'") {
      i += 1;
      while (i < text.length) {
        if (text[i] === "'") {
          if (text[i + 1] === "'") { i += 2; continue; }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    // 双引号标量：允许反斜杠转义
    if (ch === '"') {
      i += 1;
      while (i < text.length) {
        if (text[i] === "\\") { i += 2; continue; }
        if (text[i] === '"') { i += 1; break; }
        i += 1;
      }
      continue;
    }

    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      const prev = i > 0 ? text[i - 1] : "";
      // 前一个字符不能是标识符/数字/小数点，否则 a-1、1.5.3 之类会被误切
      if (!/[\w.+-]/.test(prev)) {
        const match = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i, i + 40));
        if (match) {
          const token = match[0];
          if (!/[.eE]/.test(token) && !Number.isSafeInteger(Number(token))) return i;
          i += token.length;
          continue;
        }
      }
    }

    i += 1;
  }
  return null;
}

function describePosition(text: string, index: number): string {
  const before = text.slice(0, index);
  const lastBreak = before.lastIndexOf("\n");
  return `第 ${before.split("\n").length} 行第 ${index - lastBreak} 列`;
}

/** 示例：覆盖嵌套对象、数组、布尔、null、中文与长文本，方便一键看 YAML 的实际形态 */
const SAMPLE_JSON = `{
  "service": "正月工具箱",
  "version": "1.0.0",
  "enabled": true,
  "port": 8080,
  "deprecated": null,
  "owner": {
    "name": "dev",
    "email": "dev@example.com"
  },
  "tools": ["json-format", "json-yaml", "base64"],
  "limits": {
    "maxUploadMB": 15,
    "timeoutSeconds": 30
  },
  "description": "纯前端工具站，所有处理都在浏览器本地完成。"
}`;

/** 反向示例：锚点、多行文本、注释、数字与布尔，覆盖 YAML 常见写法 */
const SAMPLE_YAML = `# 反向转换示例：YAML 转 JSON
service: 正月工具箱
version: 1.0.0
enabled: true
port: 8080
owner:
  name: dev
  email: dev@example.com
tools:
  - json-format
  - json-yaml
  - base64
limits:
  maxUploadMB: 15
  timeoutSeconds: 30
description: |
  纯前端工具站，
  所有处理都在浏览器本地完成。`;

function parseJsonLossless(text: string): unknown {
  const unsafe = findUnsafeInteger(text);
  if (unsafe !== null) {
    throw new Error(`${describePosition(text, unsafe)} 的整数超出 JS 安全范围，无损转换请给该值加引号写成字符串`);
  }
  return JSON.parse(text) as unknown;
}

/** js-yaml 在 JSON_SCHEMA 下不会产出 Date / undefined，这里只是兜住极端情况 */
function toJsonSafe(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = toJsonSafe(item);
    }
    return out;
  }
  return value;
}

/** 常见 YAML 报错的中文说法，其余保留原文，至少位置是准的 */
const YAML_REASONS: Record<string, string> = {
  "duplicated mapping key": "重复的键",
  "bad indentation of a mapping entry": "缩进不正确",
  "bad indentation of a sequence entry": "缩进不正确",
  "expected a single document in the stream, but found more": "只支持单个文档，检测到多个 YAML 文档（--- 分隔）",
  "unexpected end of the stream within a flow collection": "括号 / 引号没有闭合",
};

function loadYaml(text: string): unknown {
  const unsafe = findUnsafeYamlInteger(text);
  if (unsafe !== null) {
    throw new Error(`${describePosition(text, unsafe)} 的整数超出 JS 安全范围，转成 JSON 会丢精度，请把它改写成字符串`);
  }
  // JSON_SCHEMA：时间戳、yes/no 之类一律按字符串处理，避免转换时被悄悄改成别的值；
  // 不传 json: true —— 那个开关会让重复键后者覆盖前者，默认行为才是直接报错。
  try {
    const data = yaml.load(text, { schema: yaml.JSON_SCHEMA });
    if (data === undefined) throw new Error("没有可转换的内容：YAML 为空或只有注释");
    return data;
  } catch (cause) {
    const err = cause as { mark?: { line: number; column: number }; reason?: string };
    const reason = err?.reason ? YAML_REASONS[err.reason] ?? err.reason : "";
    // 多文档之类的错误不带位置信息，只能给文字说明
    if (!err?.mark) {
      if (reason) throw new Error(`YAML ${reason}`);
      throw cause;
    }
    throw new Error(`YAML 第 ${err.mark.line + 1} 行第 ${err.mark.column + 1} 列：${reason || "格式错误"}`);
  }
}

function convert(text: string, direction: Direction): string {
  if (direction === "json2yaml") {
    // lineWidth 关掉折行，长字符串保持一行，避免出现 >- 折叠让人以为内容被改了
    return yaml.dump(parseJsonLossless(text), { indent: 2, lineWidth: -1, noRefs: true });
  }
  return JSON.stringify(toJsonSafe(loadYaml(text)), null, 2) ?? "null";
}

/** 美化：只规范化源文本本身，不做方向转换 */
function beautify(text: string, direction: Direction): string {
  if (direction === "json2yaml") {
    return JSON.stringify(parseJsonLossless(text), null, 2);
  }
  return yaml.dump(loadYaml(text), { indent: 2, lineWidth: -1, noRefs: true });
}

function JsonYamlCore() {
  const [direction, setDirection] = useState<Direction>("json2yaml");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const isJsonSource = direction === "json2yaml";

  // 防抖：输入停止 300ms 后自动解析（空值清理放在 onChange，避免 effect 内同步 setState）
  useEffect(() => {
    if (!input.trim()) return;

    const timer = setTimeout(() => {
      try {
        setOutput(convert(input, direction));
        setError("");
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "格式错误，请检查输入内容";
        // js-yaml 的错误带多行上下文，只取首行位置信息足够定位
        setError(message.split("\n")[0]);
        setOutput("");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [input, direction]);

  const handleInputChange = (value: string) => {
    setInput(value);
    if (!value.trim()) {
      setOutput("");
      setError("");
    } else if (error) {
      setError(""); // 用户继续输入时先清除上一次错误，等防抖结束再判定
    }
  };

  /**
   * 切换方向 = 反向转换：把上一次的结果搬到输入框，再用新方向算一遍。
   * 没有结果（空输入 / 报错）时保留原文本，用户不至于丢掉正在写的内容。
   */
  const handleDirectionChange = useCallback(
    (next: Direction) => {
      if (next === direction) return;
      const carry = output;
      setDirection(next);
      setError("");
      if (carry) {
        setInput(carry);
        setOutput("");
      }
    },
    [direction, output]
  );

  const handleClear = () => {
    setInput("");
    setOutput("");
    setError("");
  };

  const handleLoadSample = () => {
    setInput(isJsonSource ? SAMPLE_JSON : SAMPLE_YAML);
    setError("");
  };

  const handleBeautify = () => {
    try {
      setInput(beautify(input, direction));
      setError("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "格式错误，无法美化";
      setError(message.split("\n")[0]);
    }
  };

  // 实时统计
  const stats = useMemo(() => {
    const lines = input.split("\n").filter(Boolean).length;
    return { lines, chars: input.length };
  }, [input]);

  const inputLabel = isJsonSource ? "JSON 输入" : "YAML 输入";
  const outputLabel = isJsonSource ? "YAML 输出" : "JSON 输出";

  return (
    <>
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Segmented
          label="转换方向"
          value={direction}
          options={DIRECTION_OPTIONS}
          onChange={handleDirectionChange}
        />
        <button onClick={handleLoadSample} className="ui-btn ui-btn-ghost ui-btn-sm">
          示例
        </button>
        <button
          onClick={handleBeautify}
          disabled={!input.trim()}
          className="ui-btn ui-btn-ghost ui-btn-sm"
        >
          {isJsonSource ? "美化 JSON" : "规范化 YAML"}
        </button>
        {input && (
          <button
            onClick={handleClear}
            className="ui-btn ui-btn-ghost ui-btn-sm hover:text-red-600"
          >
            清空
          </button>
        )}
        {input && (
          <span className="ml-auto text-xs text-slate-500">
            {stats.lines} 行 · {stats.chars} 字符
          </span>
        )}
      </div>

      {/* 主体双栏布局 */}
      <div className="flex flex-col lg:flex-row gap-6 ui-editor">
        {/* 左侧输入框 */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3 min-h-8">
            <label htmlFor="convert-input" className="ui-label text-sm">{inputLabel}</label>
            {error && (
              <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                <AlertCircle size={14} /> 格式有误
              </span>
            )}
          </div>
          <textarea
            id="convert-input"
            className={`ui-textarea flex-1 resize-none ${
              error ? "border-red-300 bg-red-50/30" : ""
            }`}
            placeholder={
              isJsonSource
                ? `{\n  "name": "DevTools",\n  "awesome": true,\n  "tags": ["json", "yaml", "converter"]\n}`
                : `name: DevTools\nawesome: true\ntags:\n  - json\n  - yaml`
            }
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-label={inputLabel}
            aria-invalid={!!error}
          />
        </div>

        {/* 右侧输出框 */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3 min-h-8">
            <label htmlFor="convert-output" className="ui-label text-sm">{outputLabel}</label>
            <div className="flex items-center gap-2">
              {output && (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <Check size={12} /> 已转换
                </span>
              )}
              <CopyButton value={output} label={`复制 ${isJsonSource ? "YAML" : "JSON"}`} />
            </div>
          </div>
          <textarea
            id="convert-output"
            className="ui-textarea flex-1 resize-none"
            readOnly
            value={output}
            placeholder={`输入 ${isJsonSource ? "JSON" : "YAML"} 后自动转换...`}
          />
        </div>
      </div>

      {/* 错误详情：完整错误放在下方，长消息不挤占标题行 */}
      {error && (
        <Notice tone="error" className="mt-4">
          {error}
        </Notice>
      )}

      {/* 空状态提示 */}
      {!input && !output && (
        <Notice tone="tip" className="mt-6">
          左侧粘贴{isJsonSource ? " JSON" : " YAML"}，<strong>实时自动转换</strong>为
          {isJsonSource ? " YAML" : " JSON"}；切换上方方向即可反向转换。
        </Notice>
      )}

      {/* 加载状态（解析中） */}
      {input.trim() && !output && !error && (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
          解析中...
        </div>
      )}
    </>
  );
}

// ============ 页面导出（用 ToolShell 包裹） ============

export default function JsonYamlPage() {
  return (
    <ToolShell>
      <JsonYamlCore />
    </ToolShell>
  );
}
