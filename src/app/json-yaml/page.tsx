// app/json-yaml/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import yaml from "js-yaml";
import { AlertCircle, Check } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Notice, CopyButton } from "@/components/ui/ToolUI";

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

function describePosition(text: string, index: number): string {
  const before = text.slice(0, index);
  const lastBreak = before.lastIndexOf("\n");
  return `第 ${before.split("\n").length} 行第 ${index - lastBreak} 列`;
}

function parseJsonLossless(text: string): unknown {
  const unsafe = findUnsafeInteger(text);
  if (unsafe !== null) {
    throw new Error(`${describePosition(text, unsafe)} 的整数超出 JS 安全范围，无损转换请给该值加引号写成字符串`);
  }
  return JSON.parse(text) as unknown;
}

function JsonYamlCore() {
  const [jsonInput, setJsonInput] = useState("");
  const [yamlOutput, setYamlOutput] = useState("");
  const [error, setError] = useState("");

  // 防抖：输入停止 300ms 后自动解析（空值清理放在 onChange，避免 effect 内同步 setState）
  useEffect(() => {
    if (!jsonInput.trim()) return;

    const timer = setTimeout(() => {
      try {
        const jsonObj = parseJsonLossless(jsonInput);
        setYamlOutput(yaml.dump(jsonObj, { indent: 2 }));
        setError("");
      } catch (cause) {
        // 保留 JSON.parse 自带的位置信息，便于定位错误
        setError(cause instanceof Error ? cause.message : "JSON 格式错误，请检查输入内容！");
        setYamlOutput("");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [jsonInput]);

  const handleInputChange = (value: string) => {
    setJsonInput(value);
    if (!value.trim()) {
      setYamlOutput("");
      setError("");
    } else if (error) {
      setError(""); // 用户继续输入时先清除上一次错误，等防抖结束再判定
    }
  };

  // 清空
  const handleClear = () => {
    setJsonInput("");
    setYamlOutput("");
    setError("");
  };

  // 格式化 JSON（美化输入）
  const handleFormatJson = () => {
    try {
      const jsonObj = parseJsonLossless(jsonInput);
      setJsonInput(JSON.stringify(jsonObj, null, 2));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "JSON 格式错误，无法格式化！请检查输入内容。");
    }
  };

  // 实时统计
  const stats = useMemo(() => {
    const lines = jsonInput.split("\n").filter(Boolean).length;
    const chars = jsonInput.length;
    return { lines, chars };
  }, [jsonInput]);

  return (
    <>
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handleFormatJson}
            disabled={!jsonInput.trim()}
            className="ui-btn ui-btn-ghost ui-btn-sm"
          >
            格式化
          </button>
          {jsonInput && (
            <button
              onClick={handleClear}
              className="ui-btn ui-btn-ghost ui-btn-sm hover:text-red-600"
            >
              清空
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* 实时统计 */}
          {jsonInput && (
            <span className="text-xs text-slate-500">
              {stats.lines} 行 · {stats.chars} 字符
            </span>
          )}
          
        </div>
      </div>

      {/* 主体双栏布局 */}
      <div className="flex flex-col lg:flex-row gap-6 ui-editor">
        
        {/* 左侧输入框 */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <label htmlFor="json-input" className="ui-label text-sm">JSON 输入</label>
            {error && (
              <span className="flex items-center text-xs text-red-500 font-medium animate-pulse">
                <AlertCircle size={14} className="mr-1" /> {error}
              </span>
            )}
          </div>
          <textarea
            id="json-input"
            className={`ui-textarea flex-1 resize-none ${
              error ? "border-red-300 bg-red-50/30" : ""
            }`}
            placeholder={`{
  "name": "DevTools",
  "awesome": true,
  "tags": ["json", "yaml", "converter"]
}`}
            value={jsonInput}
            onChange={(e) => handleInputChange(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-label="JSON 输入"
            aria-invalid={!!error}
          />
        </div>

        {/* 右侧输出框 */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <label htmlFor="yaml-output" className="ui-label text-sm">YAML 输出</label>
            <div className="flex items-center gap-2">
              {yamlOutput && (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <Check size={12} /> 已转换
                </span>
              )}
              <CopyButton value={yamlOutput} label="复制 YAML" />
            </div>
          </div>
          <textarea
            id="yaml-output"
            className="ui-textarea flex-1 resize-none"
            readOnly
            value={yamlOutput}
            placeholder="输入 JSON 后自动转换..."
          />
        </div>
      </div>

      {/* 空状态提示 */}
      {!jsonInput && !yamlOutput && (
        <Notice tone="tip" className="mt-6">
          在左侧输入或粘贴标准 JSON 数据，<strong>实时自动转换</strong>为 YAML 格式，无需点击按钮。
        </Notice>
      )}

      {/* 加载状态（解析中） */}
      {jsonInput.trim() && !yamlOutput && !error && (
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