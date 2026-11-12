// app/lucky-draw/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus, Trash2, RefreshCw, Copy, Download,
  Users, Settings, Play, Pause, Check, X
} from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Notice, writeClipboard } from "@/components/ui/ToolUI";

// 定义粒子数据的类型
interface Particle {
  left: number;
  top: number;
  delay: number;
  duration: number;
}

/** 背景粒子：确定性数据，避免水合不一致与挂载后 setState */
const PARTICLES: Particle[] = Array.from({ length: 20 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 61 + 7) % 100,
  delay: (i % 5) * 0.4,
  duration: 2 + (i % 4) * 0.7,
}));

/** 无偏洗牌（Fisher-Yates），打乱名单与抽奖共用 */
function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function LuckyDrawPage() {
  // 名单管理
  const [participants, setParticipants] = useState<string[]>([
    "张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十"
  ]);
  const [newName, setNewName] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  
  // 抽奖配置
  const [drawCount, setDrawCount] = useState(1);
  const [allowRepeat, setAllowRepeat] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDisplay, setCurrentDisplay] = useState("准备抽奖...");
  const [winners, setWinners] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  
  // 动画控制
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawIdRef = useRef(0);
  const namesRef = useRef<string[]>([]);

  // 同步 ref（避免动画闭包问题）
  useEffect(() => {
    namesRef.current = participants;
  }, [participants]);

  // 卸载时清理所有定时器，避免离开页面后仍 setState
  useEffect(() => () => {
    if (animationRef.current) clearTimeout(animationRef.current);
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
  }, []);

  const stopTimers = () => {
    if (animationRef.current) clearTimeout(animationRef.current);
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    animationRef.current = null;
    resultTimerRef.current = null;
  };

  // 添加参与者
  const addParticipant = () => {
    const name = newName.trim();
    if (!name || participants.includes(name)) return;
    setParticipants([...participants, name]);
    setNewName("");
  };

  // 删除参与者
  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditValue("");
    }
  };

  // 编辑参与者
  const startEdit = (index: number, name: string) => {
    setEditingIndex(index);
    setEditValue(name);
  };

  const saveEdit = (index: number) => {
    const value = editValue.trim();
    if (!value) return;
    const newList = [...participants];
    newList[index] = value;
    setParticipants(newList);
    setEditingIndex(null);
    setEditValue("");
  };

  // 批量导入（支持换行/逗号分隔）
  const handleBulkImport = (text: string) => {
    const names = text
      .split(/[\n,，、\s]+/)
      .map(n => n.trim())
      .filter(n => n && !participants.includes(n));
    if (names.length > 0) {
      setParticipants([...participants, ...names]);
    }
  };

  // 清空所有
  const clearAll = () => {
    if (confirm("确定要清空所有参与者吗？")) {
      setParticipants([]);
      setWinners([]);
      setShowResult(false);
    }
  };

  // 🔥 核心：抽奖动画 + 逻辑
  const startDraw = () => {
    if (participants.length === 0 || isDrawing) return;
    if (!allowRepeat && drawCount > participants.length) {
      alert(`最多只能抽 ${participants.length} 人（不重复模式）；如需更多名额请勾选「允许重复中奖」`);
      return;
    }

    stopTimers();
    const drawId = ++drawIdRef.current;
    setIsDrawing(true);
    setShowResult(false);
    setWinners([]);

    // 动画：快速滚动名字
    const animate = () => {
      if (drawIdRef.current !== drawId) return;
      const list = namesRef.current.length ? namesRef.current : participants;
      setCurrentDisplay(list[Math.floor(Math.random() * list.length)]);
      animationRef.current = setTimeout(animate, 50 + Math.random() * 50);
    };
    animate();

    // 实际抽奖逻辑（延迟执行，制造悬念）
    resultTimerRef.current = setTimeout(() => {
      if (drawIdRef.current !== drawId) return; // 已被停止 / 重新开奖
      stopTimers();

      // 允许重复：每次都从完整名单抽；不重复：抽中即移出候选池
      const results: string[] = [];
      if (allowRepeat) {
        const pool = namesRef.current.length ? namesRef.current : participants;
        for (let i = 0; i < drawCount && pool.length; i++) {
          results.push(pool[Math.floor(Math.random() * pool.length)]);
        }
      } else {
        results.push(...shuffle(namesRef.current.length ? namesRef.current : participants).slice(0, drawCount));
      }

      setCurrentDisplay("🎉 抽奖完成！");
      setWinners(results);
      setShowResult(true);
      setIsDrawing(false);
    }, 2000 + Math.min(drawCount, 10) * 300);
  };

  // 重置 / 停止抽奖：让旧结果定时器彻底失效
  const resetDraw = () => {
    drawIdRef.current += 1;
    stopTimers();
    setIsDrawing(false);
    setCurrentDisplay("准备抽奖...");
    setWinners([]);
    setShowResult(false);
  };

  // 复制结果
  const copyResults = async () => {
    if (winners.length === 0) return;
    const text = `🎁 抽奖结果：\n${winners.map((w, i) => `${i + 1}. ${w}`).join("\n")}`;
    const ok = await writeClipboard(text);
    alert(ok ? "结果已复制到剪贴板" : "复制失败，请检查浏览器剪贴板权限");
  };

  // 下载结果
  const downloadResults = () => {
    if (winners.length === 0) return;
    const content = `抽奖结果 - ${new Date().toLocaleString("zh-CN")}\n\n${
      winners.map((w, i) => `${i + 1}. ${w}`).join("\n")
    }\n\n参与名单：\n${participants.join("\n")}`;
    
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `抽奖结果-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 随机打乱名单（用于预览）
  const shuffleList = () => {
    setParticipants(shuffle(participants));
  };

  return (
    <ToolShell>
      <div className="space-y-6">
        {/* 顶部：抽奖显示区 */}
        <div className="relative p-8 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl text-white text-center overflow-hidden">
          {/* 背景粒子使用模块级确定性数据，SSR 与客户端渲染一致 */}
          <div className="absolute inset-0 opacity-20">
            {PARTICLES.map((p, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-white rounded-full animate-pulse"
                style={{
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                }}
              />
            ))}
          </div>
          
          <div className="relative z-10">
            <div className="text-sm font-medium opacity-90 mb-2">
              {isDrawing ? "🎲 抽奖进行中..." : showResult ? "🏆 获奖者" : "✨ 准备抽奖"}
            </div>
            <div className={`text-3xl md:text-5xl font-bold transition-all ${
              isDrawing ? "animate-pulse scale-105" : showResult ? "text-yellow-300" : ""
            }`}>
              {currentDisplay}
            </div>
            {showResult && winners.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {winners.map((w, i) => (
                  <span 
                    key={i} 
                    className="px-4 py-2 bg-white/20 rounded-full text-lg font-medium backdrop-blur-sm"
                  >
                    🥇 {w}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={isDrawing ? resetDraw : startDraw}
            disabled={participants.length === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
              isDrawing
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 text-white hover:-translate-y-0.5 shadow-lg shadow-indigo-600/30"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isDrawing ? <Pause size={20} /> : <Play size={20} />}
            {isDrawing ? "停止" : participants.length > 0 ? "开始抽奖" : "添加参与者后开始"}
          </button>
          
          {showResult && (
            <>
              <button
                onClick={copyResults}
                className="ui-btn ui-btn-ghost"
              >
                <Copy size={16} /> 复制结果
              </button>
              <button
                onClick={downloadResults}
                className="ui-btn ui-btn-ghost"
              >
                <Download size={16} /> 下载
              </button>
            </>
          )}
          
          <button
            onClick={shuffleList}
            disabled={participants.length < 2}
            className="ui-btn ui-btn-ghost"
            title="随机打乱名单顺序"
          >
            <RefreshCw size={16} /> 打乱
          </button>
        </div>

        {/* 配置区域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-3">
            <Settings size={18} className="text-slate-500" />
            <label htmlFor="draw-count" className="text-sm font-medium text-slate-700">抽取人数：</label>
            <input
              id="draw-count"
              type="number"
              min={1}
              max={100}
              value={drawCount}
              onChange={(e) => setDrawCount(Math.max(1, Math.min(100, Number(e.target.value))))}
              disabled={isDrawing}
              className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="allowRepeat"
              checked={allowRepeat}
              onChange={(e) => setAllowRepeat(e.target.checked)}
              disabled={isDrawing}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
            <label htmlFor="allowRepeat" className="text-sm text-slate-700">
              允许重复中奖
            </label>
          </div>
        </div>

        {/* 参与者管理 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Users size={18} /> 参与者名单 ({participants.length})
            </h3>
            {participants.length > 0 && (
              <button
                onClick={clearAll}
                className="text-sm text-red-500 hover:text-red-600 transition-colors"
              >
                清空全部
              </button>
            )}
          </div>

          {/* 添加输入框 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addParticipant()}
              placeholder="输入姓名，按回车添加..."
              disabled={isDrawing}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:opacity-50"
            />
            <button
              onClick={addParticipant}
              disabled={!newName.trim() || isDrawing}
              className="ui-btn ui-btn-primary"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* 批量导入 */}
          <details className="group">
            <summary className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer hover:text-indigo-600">
              <span>批量导入（支持换行/逗号分隔）</span>
              <span className="transition-transform group-open:rotate-180">▼</span>
            </summary>
            <textarea
              placeholder="张三&#10;李四&#10;王五，赵六、钱七"
              className="ui-textarea font-sans h-24 mt-2"
              onBlur={(e) => {
                if (e.target.value.trim()) {
                  handleBulkImport(e.target.value);
                  e.target.value = "";
                }
              }}
            />
          </details>

          {/* 名单列表 */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {participants.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                暂无参与者，添加姓名开始抽奖 🎁
              </div>
            ) : (
              participants.map((name, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    winners.includes(name)
                      ? "bg-emerald-50 border-emerald-300"
                      : "bg-white border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  {editingIndex === index ? (
                    <>
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(index);
                          if (e.key === "Escape") {
                            setEditingIndex(null);
                            setEditValue("");
                          }
                        }}
                        autoFocus
                        className="flex-1 px-2 py-1 border border-indigo-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      />
                      <button
                        onClick={() => saveEdit(index)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                        title="保存"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingIndex(null);
                          setEditValue("");
                        }}
                        className="ui-icon-btn"
                        title="取消"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`flex-1 font-medium ${
                        winners.includes(name) ? "text-emerald-700" : "text-slate-700"
                      }`}>
                        {winners.includes(name) && "🏆 "}
                        {name}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(index, name)}
                          disabled={isDrawing}
                          className="ui-icon-btn hover:text-indigo-600"
                          title="编辑"
                        >
                          <Settings size={14} />
                        </button>
                        <button
                          onClick={() => removeParticipant(index)}
                          disabled={isDrawing}
                          className="ui-icon-btn text-red-600 hover:bg-red-50"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 使用说明 */}
        <Notice tone="info">
          <strong>使用提示：</strong>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>添加参与者后，设置抽取人数，点击「开始抽奖」</li>
            <li>勾选「允许重复」可让同一人中多次奖</li>
            <li>抽奖结果支持复制和下载保存</li>
            <li>纯前端运行，所有数据仅保存在本地，刷新页面会重置</li>
          </ul>
        </Notice>
      </div>
    </ToolShell>
  );
}