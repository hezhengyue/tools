"use client";
import { useState } from "react";
import yaml from "js-yaml";
import { FileJson, ArrowRightLeft, AlertCircle } from "lucide-react";

export default function JsonToYaml() {
  const [jsonInput, setJsonInput] = useState("");
  const [yamlOutput, setYamlOutput] = useState("");
  const [error, setError] = useState("");

  const handleConvert = () => {
    setError(""); // 清空错误
    if (!jsonInput.trim()) {
      setYamlOutput("");
      return;
    }
    
    try {
      const jsonObj = JSON.parse(jsonInput);
      const yamlStr = yaml.dump(jsonObj, { indent: 2 });
      setYamlOutput(yamlStr);
    } catch (err: any) {
      setError("JSON 格式错误，请检查输入内容！");
      setYamlOutput("");
    }
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      {/* 头部标题区域 */}
      <div className="mb-8 shrink-0">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center shadow-inner">
            <FileJson size={24} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">JSON 转 YAML</h1>
        </div>
        <p className="text-slate-500">输入标准 JSON 数据，一键解析并转化为结构化的 YAML 格式。</p>
      </div>

      {/* 主体操作面板 (利用 flex-1 填满剩余高度) */}
      <div className="flex-1 bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col lg:flex-row gap-6 min-h-[500px]">
        
        {/* 左侧输入框 */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <label className="font-bold text-slate-700 text-sm tracking-wide">JSON 输入</label>
            {error && (
              <span className="flex items-center text-xs text-red-500 font-medium">
                <AlertCircle size={14} className="mr-1" /> {error}
              </span>
            )}
          </div>
          <textarea 
            className={`flex-1 w-full p-5 bg-slate-50/50 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all font-mono text-sm resize-none text-slate-700 ${
              error ? "border-red-300 bg-red-50/30" : "border-slate-200 focus:border-teal-500"
            }`}
            placeholder="在此粘贴或输入 JSON 数据...&#10;{&#10;  &quot;name&quot;: &quot;DevTools&quot;,&#10;  &quot;awesome&quot;: true&#10;}"
            value={jsonInput}
            onChange={(e) => {
              setJsonInput(e.target.value);
              if (error) setError(""); // 用户重新输入时取消报错提示
            }}
          ></textarea>
        </div>

        {/* 中间转换按钮 */}
        <div className="flex lg:flex-col items-center justify-center gap-4 py-2 lg:py-0">
          <button 
            onClick={handleConvert}
            className="group flex items-center justify-center w-14 h-14 bg-teal-600 text-white rounded-2xl hover:bg-teal-700 hover:-translate-y-1 hover:shadow-lg hover:shadow-teal-600/30 transition-all active:translate-y-0"
            title="点击转换"
          >
            <ArrowRightLeft className="lg:rotate-0 rotate-90 transition-transform group-hover:scale-110" size={24} />
          </button>
        </div>

        {/* 右侧输出框 */}
        <div className="flex-1 flex flex-col">
          <label className="font-bold text-slate-700 text-sm tracking-wide mb-3">YAML 输出</label>
          <textarea 
            className="flex-1 w-full p-5 bg-slate-100 border border-slate-200 rounded-2xl focus:outline-none font-mono text-sm resize-none text-slate-800 shadow-inner"
            readOnly
            value={yamlOutput}
            placeholder="转换后的 YAML 结果将显示在这里..."
          ></textarea>
        </div>

      </div>
    </div>
  );
}