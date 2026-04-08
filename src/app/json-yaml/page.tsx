// app/json-yaml/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import yaml from "js-yaml";
import { AlertCircle, Copy, Check } from "lucide-react";
import ToolShell from "@/components/ToolShell";

// ============ 核心功能组件（只写业务逻辑） ============

function JsonYamlCore() {
  const [jsonInput, setJsonInput] = useState("");
  const [yamlOutput, setYamlOutput] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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

  // 复制功能
  const copyToClipboard = async () => {
    if (!yamlOutput) return;
    try {
      await navigator.clipboard.writeText(yamlOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("复制失败:", err);
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
            className="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            格式化
          </button>
          {jsonInput && (
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors"
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
          
          {/* 复制按钮 */}
          {yamlOutput && (
            <button
              onClick={copyToClipboard}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all ${
                copied
                  ? "bg-green-100 text-green-600"
                  : "bg-teal-600 text-white hover:bg-teal-700"
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "已复制" : "复制"}
            </button>
          )}
        </div>
      </div>

      {/* 主体双栏布局 */}
      <div className="flex flex-col lg:flex-row gap-6 min-h-[500px]">
        
        {/* 左侧输入框 */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <label className="font-bold text-slate-700 text-sm tracking-wide">JSON 输入</label>
            {error && (
              <span className="flex items-center text-xs text-red-500 font-medium animate-pulse">
                <AlertCircle size={14} className="mr-1" /> {error}
              </span>
            )}
          </div>
          <textarea 
            className={`flex-1 w-full p-5 bg-slate-50/50 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all font-mono text-sm resize-none text-slate-700 ${
              error ? "border-red-300 bg-red-50/30" : "border-slate-200 focus:border-teal-500"
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
            <label className="font-bold text-slate-700 text-sm tracking-wide">YAML 输出</label>
            {yamlOutput && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <Check size={12} /> 已转换
              </span>
            )}
          </div>
          <textarea 
            className="flex-1 w-full p-5 bg-slate-100 border border-slate-200 rounded-2xl focus:outline-none font-mono text-sm resize-none text-slate-800 shadow-inner"
            readOnly
            value={yamlOutput}
            placeholder="输入 JSON 后自动转换..."
          />
        </div>
      </div>

      {/* 空状态提示 */}
      {!jsonInput && !yamlOutput && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-sm flex items-start gap-2">
          <span>💡</span>
          <span>在左侧输入或粘贴标准 JSON 数据，<strong>实时自动转换</strong>为 YAML 格式，无需点击按钮。</span>
        </div>
      )}

      {/* 加载状态（解析中） */}
      {jsonInput.trim() && !yamlOutput && !error && (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-teal-500 rounded-full animate-spin" />
          解析中...
        </div>
      )}
    </>
  );
}

// ============ 页面导出（用 ToolShell 包裹） ============

export default function JsonYamlPage() {
  return (
    <ToolShell showFooter={false}>
      <JsonYamlCore />
    </ToolShell>
  );
}