// app/password/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Check, RefreshCw } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { CopyButton } from "@/components/ui/ToolUI";

// ============ 模块级纯函数：密码学安全随机，不依赖 Math.random ============

const CHAR_SETS = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  num: "0123456789",
  sym: "!@#$%^&*()_+~`|}{[]:;?><,./-=",
} as const;

/** 用 crypto.getRandomValues + 拒绝采样，生成 [0, max) 的无偏整数 */
function secureRandomInt(max: number): number {
  if (max <= 0) return 0;
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

function pick(chars: string): string {
  return chars[secureRandomInt(chars.length)];
}

interface PasswordOptions {
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

/** 生成密码：每个勾选类型至少 1 个字符，Fisher-Yates 洗牌 */
function createPassword(length: number, options: PasswordOptions): string {
  const enabled: string[] = [];
  if (options.uppercase) enabled.push(CHAR_SETS.upper);
  if (options.lowercase) enabled.push(CHAR_SETS.lower);
  if (options.numbers) enabled.push(CHAR_SETS.num);
  if (options.symbols) enabled.push(CHAR_SETS.sym);
  if (enabled.length === 0) return "";

  const allChars = enabled.join("");
  const chars = enabled.map(pick);
  // 长度小于勾选类型数时，仍保证每个类型至少一个字符（结果会比设定长度长）
  while (chars.length < length) chars.push(pick(allChars));

  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function evaluateStrength(pwd: string): { label: string; level: number; color: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (pwd.length >= 16) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;

  if (!pwd) return { label: "无效", level: 0, color: "gray" };
  if (score <= 2) return { label: "弱", level: 1, color: "red" };
  if (score <= 4) return { label: "中", level: 2, color: "orange" };
  if (score <= 6) return { label: "强", level: 3, color: "blue" };
  return { label: "极高", level: 4, color: "green" };
}

function clampLength(value: number): number {
  return Number.isFinite(value) ? Math.min(64, Math.max(8, Math.round(value))) : 16;
}

// ============ 核心功能组件（只写业务逻辑） ============

function PasswordGeneratorCore() {
  const [password, setPassword] = useState("");
  const [length, setLength] = useState(16);
  // 数字输入框允许中间态（比如输入 20 时的 "2"），失焦时才规范化
  const [lengthDraft, setLengthDraft] = useState("16");
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [options, setOptions] = useState<PasswordOptions>({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  });

  const [strength, setStrength] = useState(evaluateStrength(""));

  const generatePassword = useCallback(() => {
    const next = createPassword(length, options);
    setPassword(next);
    setCopied(false);
    setStrength(evaluateStrength(next));
  }, [length, options]);

  // 参数变化后自动生成
  useEffect(() => {
    // 放到微任务里生成，避免 effect 内同步 setState 造成级联渲染
    queueMicrotask(generatePassword);
  }, [generatePassword]);

  // 卸载时清理复制提示定时器
  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const flashCopied = () => {
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  const handleLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLengthDraft(e.target.value);
    const parsed = Number(e.target.value);
    // 只有完整合法的两位数才即时生效，避免 "2" 被 clamp 成 8 导致输不进 20
    if (e.target.value !== "" && parsed >= 8 && parsed <= 64) {
      setLength(Math.round(parsed));
    }
  };

  const commitLength = () => {
    const next = clampLength(Number(lengthDraft));
    setLength(next);
    setLengthDraft(String(next));
  };

  const setLengthFromRange = (value: number) => {
    const next = clampLength(value);
    setLength(next);
    setLengthDraft(String(next));
  };

  const toggle = (key: keyof PasswordOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedCount = Object.values(options).filter(Boolean).length;

  return (
    <>
      {/* 密码展示 */}
      <div className="relative mb-6 group">
        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center break-all text-2xl md:text-3xl font-mono text-slate-800 min-h-[100px] flex items-center justify-center shadow-inner relative overflow-hidden">
          {password || "请选择字符类型"}

          {copied && (
            <div className="absolute inset-0 bg-emerald-50 text-emerald-700 flex items-center justify-center rounded-2xl animate-fade-in-up text-lg font-medium">
              <Check className="w-5 h-5 mr-2" />
              复制成功
            </div>
          )}
        </div>

        <CopyButton
          value={password}
          label="复制密码"
          onCopied={flashCopied}
          size={20}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white border border-slate-200 shadow-sm hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
        />
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
                ? "text-slate-500"
                : "text-emerald-700"
            }`}
            aria-live="polite"
          >
            {strength.label}
          </span>
        </div>
        <div className="flex gap-2 h-1.5">
          <div className={`h-full rounded-full flex-1 ${strength.level >= 1 ? "bg-red-500" : "bg-slate-200"}`} />
          <div className={`h-full rounded-full flex-1 ${strength.level >= 2 ? "bg-orange-500" : "bg-slate-200"}`} />
          <div className={`h-full rounded-full flex-1 ${strength.level >= 3 ? "bg-blue-500" : "bg-slate-200"}`} />
          <div className={`h-full rounded-full flex-1 ${strength.level >= 4 ? "bg-emerald-500" : "bg-slate-200"}`} />
        </div>
      </div>

      {/* 密码长度 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <label htmlFor="password-length" className="font-semibold text-slate-700">密码长度</label>
          <div className="flex items-center gap-2">
            <input
              id="password-length"
              type="number"
              min={8}
              max={64}
              value={lengthDraft}
              onChange={handleLengthChange}
              onBlur={commitLength}
              onKeyDown={(e) => e.key === "Enter" && commitLength()}
              className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center text-sm"
            />
            <span className="text-sm text-slate-500">位</span>
          </div>
        </div>
        <input
          type="range"
          min="8"
          max="64"
          value={length}
          onChange={(e) => setLengthFromRange(Number(e.target.value))}
          aria-label="密码长度滑块"
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
      </div>

      {/* 选项 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.uppercase}
            onChange={() => toggle("uppercase")}
            className="ui-checkbox"
          />
          <span className="text-sm text-slate-700">大写字母 A-Z</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.lowercase}
            onChange={() => toggle("lowercase")}
            className="ui-checkbox"
          />
          <span className="text-sm text-slate-700">小写字母 a-z</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.numbers}
            onChange={() => toggle("numbers")}
            className="ui-checkbox"
          />
          <span className="text-sm text-slate-700">数字 0-9</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.symbols}
            onChange={() => toggle("symbols")}
            className="ui-checkbox"
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
        className="ui-btn ui-btn-primary ui-btn-block"
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
