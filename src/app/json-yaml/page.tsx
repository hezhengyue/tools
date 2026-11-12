// app/json-yaml/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import yaml from "js-yaml";
import { AlertCircle, Check } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Notice, CopyButton } from "@/components/ui/ToolUI";

// ============ 核心功能组件（只写业务逻辑） ============

function JsonYamlCore() {
  const [jsonInput, setJsonInput] = useState("");
  const [yamlOutput, setYamlOutput] = useState("");
  const [error, setError] = useState("");

  // 防抖：输入停止 300ms 后自动解析
  useEffect(() => {
    if (!jsonInput.trim()) {
      setYamlOutput("");
      setError("");
      return;
    }

    const timer = setTimeout(() => {
      try {
        const jsonObj = JSON.parse(jsonInput);
        const yamlStr = yaml.dump(jsonObj, { indent: 2 });
        setYamlOutput(yamlStr);
        setError("");
      } catch (err: any) {
        // 只在输入"看起来像完整对象"时才报错，避免打字中途频繁提示
        if (jsonInput.trim().startsWith("{") || jsonInput.trim().startsWith("[")) {
          setError("JSON 格式错误，请检查输入内容！");
        }
        setYamlOutput("");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [jsonInput]);

  // 清空
  const handleClear = () => {
    setJsonInput("");
    setYamlOutput("");
    setError("");
  };

  // 格式化 JSON（美化输入）
  const handleFormatJson = () => {
    try {
      const jsonObj = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(jsonObj, null, 2));
      setError("");
    } catch {
      // 不处理格式化错误，留给自动解析时提示
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
            <span className="text-xs text-slate-400">
              {stats.lines} 行 · {stats.chars} 字符
            </span>
          )}
          
        </div>
      </div>

      {/* 主体双栏布局 */}
      <div className="flex flex-col lg:flex-row gap-6 min-h-[500px]">
        
        {/* 左侧输入框 */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <label className="ui-label text-sm">JSON 输入</label>
            {error && (
              <span className="flex items-center text-xs text-red-500 font-medium animate-pulse">
                <AlertCircle size={14} className="mr-1" /> {error}
              </span>
            )}
          </div>
          <textarea 
            className={`ui-textarea flex-1 resize-none ${
              error ? "border-red-300 bg-red-50/30" : ""
            }`}
            placeholder={`{
  "name": "DevTools",
  "awesome": true,
  "tags": ["json", "yaml", "converter"]
}`}
            value={jsonInput}
            onChange={(e) => {
              setJsonInput(e.target.value);
              if (error) setError(""); // 用户继续输入时清除错误
            }}
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        {/* 右侧输出框 */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <label className="ui-label text-sm">YAML 输出</label>
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
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
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