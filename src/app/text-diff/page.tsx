// app/text-diff/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Copy, Check, RefreshCw, ArrowRightLeft, FileDiff } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { useTextDiff, type DiffMode } from "./useTextDiff";

function TextDiffCore() {
  const [oldText, setOldText] = useState("");
  const [newText, setNewText] = useState("");
  const [mode, setMode] = useState<DiffMode>("lines");
  const [copied, setCopied] = useState<"old" | "new" | "diff" | null>(null);
  
  const { result, isComputing, error, computeDiff } = useTextDiff();

  // 自动计算（防抖）
  useEffect(() => {
    if (!oldText && !newText) return;
    
    const timer = setTimeout(() => {
      computeDiff({ oldText, newText, mode });
    }, 300);
    
    return () => clearTimeout(timer);
  }, [oldText, newText, mode, computeDiff]);

  const copyToClipboard = async (text: string, type: "old" | "new" | "diff") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 1500);
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  const swapTexts = () => {
    setOldText(newText);
    setNewText(oldText);
  };

  const clearAll = () => {
    setOldText("");
    setNewText("");
  };

  // 渲染差异结果（简化版，可替换为 react-diff-view 等库）
  const renderDiff = () => {
    if (!result?.diffs) return null;
    
    return (
      <div className="font-mono text-sm whitespace-pre-wrap break-all bg-slate-50 p-4 rounded-xl border border-slate-200 min-h-[200px] max-h-[400px] overflow-auto">
        {result.diffs.map((part, i) => {
          if (part.added) {
            return (
              <span key={i} className="bg-emerald-100 text-emerald-800 px-0.5 rounded">
                {part.value}
              </span>
            );
          }
          if (part.removed) {
            return (
              <span key={i} className="bg-red-100 text-red-800 line-through px-0.5 rounded">
                {part.value}
              </span>
            );
          }
          return <span key={i}>{part.value}</span>;
        })}
      </div>
    );
  };

  return (
    <>
      {/* 模式选择 + 操作按钮 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">对比模式:</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as DiffMode)}
            className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="lines">按行对比</option>
            <option value="words">按词对比</option>
            <option value="chars">按字符对比</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={swapTexts}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            title="交换左右内容"
          >
            <ArrowRightLeft size={14} />
            交换
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors"
          >
            清空
          </button>
        </div>
      </div>

      {/* 双栏输入 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* 原文本 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="font-semibold text-slate-700 text-sm">原文本 (Old)</label>
            {oldText && (
              <button
                onClick={() => copyToClipboard(oldText, "old")}
                className={`p-1.5 rounded transition-all ${
                  copied === "old" ? "text-green-600" : "text-slate-400 hover:text-indigo-600"
                }`}
                title="复制"
              >
                {copied === "old" ? <Check size={14} /> : <Copy size={14} />}
              </button>
            )}
          </div>
          <textarea
            value={oldText}
            onChange={(e) => setOldText(e.target.value)}
            placeholder="粘贴或输入原始文本..."
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm min-h-[200px] resize-y focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
          />
        </div>

        {/* 新文本 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="font-semibold text-slate-700 text-sm">新文本 (New)</label>
            {newText && (
              <button
                onClick={() => copyToClipboard(newText, "new")}
                className={`p-1.5 rounded transition-all ${
                  copied === "new" ? "text-green-600" : "text-slate-400 hover:text-indigo-600"
                }`}
                title="复制"
              >
                {copied === "new" ? <Check size={14} /> : <Copy size={14} />}
              </button>
            )}
          </div>
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="粘贴或输入修改后的文本..."
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm min-h-[200px] resize-y focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
          <span>⚠️</span>
          {error}
        </div>
      )}

      {/* 差异结果 */}
      {(oldText || newText) && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="font-semibold text-slate-700 flex items-center gap-2">
              <FileDiff size={16} />
              差异结果
            </label>
            {result && (
              <button
                onClick={() => {
                  const text = result.diffs.map(d => d.value).join("");
                  copyToClipboard(text, "diff");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all ${
                  copied === "diff"
                    ? "bg-green-100 text-green-600"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {copied === "diff" ? <Check size={14} /> : <Copy size={14} />}
                {copied === "diff" ? "已复制" : "复制结果"}
              </button>
            )}
          </div>
          
          {isComputing ? (
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
              <span className="text-slate-600">计算差异中...</span>
            </div>
          ) : result ? (
            <>
              {/* 统计信息 */}
              <div className="mb-3 flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-emerald-500 rounded" />
                  <span className="text-emerald-700 font-medium">+{result.stats.added}</span> 新增
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-red-500 rounded line-through" />
                  <span className="text-red-700 font-medium">-{result.stats.removed}</span> 删除
                </span>
                <span className="text-slate-500">
                  {result.stats.unchanged} 未变更
                </span>
              </div>
              
              {/* 差异内容 */}
              {renderDiff()}
            </>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-sm">
              输入文本后自动计算差异...
            </div>
          )}
        </div>
      )}

      {/* 空状态提示 */}
      {!oldText && !newText && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-sm flex items-start gap-2">
          <span>💡</span>
          <span>在左右两侧分别输入原文本和新文本，<strong>自动实时对比</strong>差异。支持按行/词/字符三种模式。</span>
        </div>
      )}

      {/* 手动触发按钮（备用） */}
      <button
        onClick={() => computeDiff({ oldText, newText, mode })}
        disabled={isComputing || (!oldText && !newText)}
        className="w-full flex items-center justify-center py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all disabled:opacity-50"
      >
        <RefreshCw size={18} className={`mr-2 ${isComputing ? "animate-spin" : ""}`} />
        {isComputing ? "计算中..." : "重新计算差异"}
      </button>
    </>
  );
}

export default function TextDiffPage() {
  return (
    <ToolShell>
      <TextDiffCore />
    </ToolShell>
  );
}