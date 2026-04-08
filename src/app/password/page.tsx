// app/password/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Copy, Check, RefreshCw } from "lucide-react";
import ToolShell from "@/components/ToolShell";

// ============ 核心功能组件（只写业务逻辑） ============

function PasswordGeneratorCore() {
  const [password, setPassword] = useState("");
  const [length, setLength] = useState(16);
  const [copied, setCopied] = useState(false);

  const [options, setOptions] = useState({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  });

  const [strength, setStrength] = useState<{
    label: string;
    level: number;
    color: string;
  }>({ label: "极高", level: 4, color: "green" });

  // 生成密码（确保每种勾选类型至少出现1个）
  const generatePassword = () => {
    const { uppercase, lowercase, numbers, symbols } = options;
    const selectedTypes = [uppercase, lowercase, numbers, symbols].filter(Boolean);

    if (selectedTypes.length === 0) {
      setPassword("");
      setStrength({ label: "无效", level: 0, color: "gray" });
      return;
    }

    const charSets = {
      upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      lower: "abcdefghijklmnopqrstuvwxyz",
      num: "0123456789",
      sym: "!@#$%^&*()_+~`|}{[]:;?><,./-=",
    };

    const requiredChars: string[] = [];
    if (uppercase) requiredChars.push(charSets.upper[Math.floor(Math.random() * charSets.upper.length)]);
    if (lowercase) requiredChars.push(charSets.lower[Math.floor(Math.random() * charSets.lower.length)]);
    if (numbers) requiredChars.push(charSets.num[Math.floor(Math.random() * charSets.num.length)]);
    if (symbols) requiredChars.push(charSets.sym[Math.floor(Math.random() * charSets.sym.length)]);

    let allChars = "";
    if (uppercase) allChars += charSets.upper;
    if (lowercase) allChars += charSets.lower;
    if (numbers) allChars += charSets.num;
    if (symbols) allChars += charSets.sym;

    const remainingLength = Math.max(0, length - requiredChars.length);
    let remainingChars = "";
    for (let i = 0; i < remainingLength; i++) {
      remainingChars += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    const fullPassword = [...requiredChars, ...remainingChars].sort(() => Math.random() - 0.5).join("");

    setPassword(fullPassword);
    setCopied(false);
    checkStrength(fullPassword);
  };

  // 密码强度检测
  const checkStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (pwd.length >= 16) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    if (score <= 2) {
      setStrength({ label: "弱", level: 1, color: "red" });
    } else if (score <= 4) {
      setStrength({ label: "中", level: 2, color: "orange" });
    } else if (score <= 6) {
      setStrength({ label: "强", level: 3, color: "blue" });
    } else {
      setStrength({ label: "极高", level: 4, color: "green" });
    }
  };

  // 自动生成
  useEffect(() => {
    generatePassword();
  }, [length, options]);

  // 复制
  const copyToClipboard = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // 长度输入限制
  const handleLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = Number(e.target.value);
    val = Math.min(64, Math.max(8, val));
    setLength(val);
  };

  const selectedCount = Object.values(options).filter(Boolean).length;

  return (
    <>
      {/* 密码展示 */}
      <div className="relative mb-6 group">
        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center break-all text-2xl md:text-3xl font-mono text-slate-800 min-h-[100px] flex items-center justify-center shadow-inner relative overflow-hidden">
          {password || "请选择字符类型"}

          {copied && (
            <div className="absolute inset-0 bg-green-50 text-green-600 flex items-center justify-center rounded-2xl animate-fade-in-up text-lg font-medium">
              <Check className="w-5 h-5 mr-2" />
              复制成功
            </div>
          )}
        </div>

        <button
          onClick={copyToClipboard}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 shadow-sm transition-all"
          title="复制密码"
          disabled={!password}
        >
          <Copy size={20} />
        </button>
      </div>

      {/* 密码强度 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-slate-600">密码强度</span>
          <span
            className={`text-sm font-semibold ${
              strength.color === "red"
                ? "text-red-600"
                : strength.color === "orange"
                ? "text-orange-600"
                : strength.color === "blue"
                ? "text-blue-600"
                : strength.color === "gray"
                ? "text-slate-400"
                : "text-green-600"
            }`}
          >
            {strength.label}
          </span>
        </div>
        <div className="flex gap-2 h-1.5">
          <div className={`h-full rounded-full flex-1 ${strength.level >= 1 ? "bg-red-500" : "bg-slate-200"}`} />
          <div className={`h-full rounded-full flex-1 ${strength.level >= 2 ? "bg-orange-500" : "bg-slate-200"}`} />
          <div className={`h-full rounded-full flex-1 ${strength.level >= 3 ? "bg-blue-500" : "bg-slate-200"}`} />
          <div className={`h-full rounded-full flex-1 ${strength.level >= 4 ? "bg-green-500" : "bg-slate-200"}`} />
        </div>
      </div>

      {/* 密码长度 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <label className="font-semibold text-slate-700">密码长度</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={8}
              max={64}
              value={length}
              onChange={handleLengthChange}
              className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-center text-sm"
            />
            <span className="text-sm text-slate-500">位</span>
          </div>
        </div>
        <input
          type="range"
          min="8"
          max="64"
          value={length}
          onChange={(e) => {
            const val = Number(e.target.value);
            setLength(Math.min(64, Math.max(8, val)));
          }}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
      </div>

      {/* 选项 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.uppercase}
            onChange={() => setOptions((p) => ({ ...p, uppercase: !p.uppercase }))}
            className="w-4 h-4 text-indigo-600 rounded"
          />
          <span className="text-sm text-slate-700">大写字母 A-Z</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.lowercase}
            onChange={() => setOptions((p) => ({ ...p, lowercase: !p.lowercase }))}
            className="w-4 h-4 text-indigo-600 rounded"
          />
          <span className="text-sm text-slate-700">小写字母 a-z</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.numbers}
            onChange={() => setOptions((p) => ({ ...p, numbers: !p.numbers }))}
            className="w-4 h-4 text-indigo-600 rounded"
          />
          <span className="text-sm text-slate-700">数字 0-9</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.symbols}
            onChange={() => setOptions((p) => ({ ...p, symbols: !p.symbols }))}
            className="w-4 h-4 text-indigo-600 rounded"
          />
          <span className="text-sm text-slate-700">特殊符号 !@#$</span>
        </label>
      </div>

      {/* 安全提示 */}
      {length < selectedCount && selectedCount > 0 && (
        <p className="text-amber-600 text-sm mb-6">
          ⚠️ 建议长度 ≥ 已选项数量，保证密码强度
        </p>
      )}

      {/* 生成按钮 */}
      <button
        onClick={generatePassword}
        className="w-full flex items-center justify-center py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 hover:-translate-y-0.5 transition-all shadow-md shadow-indigo-600/20 active:translate-y-0"
      >
        <RefreshCw size={18} className="mr-2" />
        重新生成密码
      </button>
    </>
  );
}

// ============ 页面导出（用 ToolShell 包裹） ============

export default function PasswordPage() {
  return (
    <ToolShell>
      <PasswordGeneratorCore />
    </ToolShell>
  );
}