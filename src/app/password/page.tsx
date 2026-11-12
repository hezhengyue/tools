// app/password/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, RefreshCw, ShieldCheck } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { CopyButton } from "@/components/ui/ToolUI";

// ============ 模块级纯函数：密码学安全随机，不依赖 Math.random ============

const BASE_SETS = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  num: "0123456789",
} as const;

/**
 * 特殊符号分三档，后一档是前一档的超集。
 * 兼容档剔除的是各系统最容易拒绝的一批字符：
 * 引号 / 反斜杠（转义）、尖括号（重定向、HTML）、反引号（shell 命令替换）、
 * 竖线分号与或（shell 元字符）、方括号花括号（glob、正则、JSON 结构）。
 */
const SYMBOL_PRESETS = {
  safe: {
    label: "兼容",
    chars: "!#$%&*+-=?@^_",
    hint: "不含引号、反斜杠、尖括号、反引号、括号和竖线。主流网站、数据库、命令行、配置文件（YAML/INI）都能直接接受，是默认推荐档。",
  },
  standard: {
    label: "标准",
    chars: "!#$%&()*+,-./:;=?@[]^_{|}~",
    hint: "额外包含括号、逗号、冒号、分号、斜杠和竖线。多数系统支持，但写进命令行或 CSV 时需要加引号转义。",
  },
  all: {
    label: "全部",
    chars: "!#$%&()*+,-./:;<=>?@[]^_{|}~`",
    hint: "再加尖括号与反引号。反引号在 shell 中是命令替换、尖括号是重定向，个别老系统会直接拒绝，仅在确认目标系统支持时使用。",
  },
} as const;

type SymbolPreset = keyof typeof SYMBOL_PRESETS;

/** 视觉易混淆字符：手抄、口述、投屏时最容易认错的一批 */
const AMBIGUOUS = "Il1O0o|";
const AMBIGUOUS_LIST = Array.from(AMBIGUOUS);

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

const CLASS_LABEL: Record<keyof PasswordOptions, string> = {
  uppercase: "大写字母",
  lowercase: "小写字母",
  numbers: "数字",
  symbols: "特殊符号",
};

interface CharClass {
  key: keyof PasswordOptions;
  chars: string;
}

/**
 * 按当前配置构建可用字符类。
 * 被排除的字符会从对应集合里剔除；剔除后为空的类直接丢弃，
 * 避免生成出「勾了符号但一个符号都没有」的密码。
 */
function buildCharClasses(
  options: PasswordOptions,
  symbolPreset: SymbolPreset,
  excluded: string
): CharClass[] {
  const ex = new Set(excluded);
  const keep = (s: string) =>
    Array.from(s)
      .filter((c) => !ex.has(c))
      .join("");

  const raw: CharClass[] = [];
  if (options.uppercase) raw.push({ key: "uppercase", chars: BASE_SETS.upper });
  if (options.lowercase) raw.push({ key: "lowercase", chars: BASE_SETS.lower });
  if (options.numbers) raw.push({ key: "numbers", chars: BASE_SETS.num });
  if (options.symbols) raw.push({ key: "symbols", chars: SYMBOL_PRESETS[symbolPreset].chars });

  return raw
    .map((c) => ({ key: c.key, chars: keep(c.chars) }))
    .filter((c) => c.chars.length > 0);
}

/** 生成密码：每个可用字符类至少 1 个字符，再 Fisher-Yates 洗牌 */
function createPassword(length: number, classes: CharClass[]): string {
  if (classes.length === 0) return "";

  const allChars = classes.map((c) => c.chars).join("");
  const chars = classes.map((c) => pick(c.chars));
  // 长度小于字符类数量时，仍保证每类至少一个（结果会比设定长度长）
  while (chars.length < length) chars.push(pick(allChars));

  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** 粗略强度评估：长度 + 字符种类 */
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

  // 默认「兼容」档：绝大多数系统都能直接接受，避免生成后到处被拒
  const [symbolPreset, setSymbolPreset] = useState<SymbolPreset>("safe");
  // 排除字符只维护输入框这一个字符串，所见即所得：
  // 勾选「排除易混淆字符」= 自动把 Il1O0o| 写进输入框，取消勾选 = 自动移除。
  const [extraExclude, setExtraExclude] = useState("");

  const [strength, setStrength] = useState(evaluateStrength(""));

  // 输入框里已经包含全部易混淆字符时，复选框即为勾选态
  const excludeAmbiguous = AMBIGUOUS_LIST.every((c) => extraExclude.includes(c));

  const toggleAmbiguous = (checked: boolean) => {
    setExtraExclude((prev) => {
      if (checked) {
        const next = new Set(Array.from(prev));
        for (const c of AMBIGUOUS_LIST) next.add(c);
        return Array.from(next).join("");
      }
      const drop = new Set(AMBIGUOUS_LIST);
      return Array.from(prev)
        .filter((c) => !drop.has(c))
        .join("");
    });
  };

  const classes = useMemo(
    () => buildCharClasses(options, symbolPreset, extraExclude),
    [options, symbolPreset, extraExclude]
  );

  // 勾选了却被排除干净的字符类型，用于给出明确提示
  const emptiedClasses = (Object.keys(options) as Array<keyof PasswordOptions>)
    .filter((key) => options[key] && !classes.some((c) => c.key === key))
    .map((key) => CLASS_LABEL[key]);

  const generatePassword = useCallback(() => {
    const next = createPassword(length, classes);
    setPassword(next);
    setCopied(false);
    setStrength(evaluateStrength(next));
  }, [length, classes]);

  // 参数变化后自动生成
  useEffect(() => {
    // 放到微任务里生成，避免 effect 内同步 setState 造成级联渲染
    queueMicrotask(generatePassword);
  }, [generatePassword]);

  // 卸载时清理复制提示定时器
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    []
  );

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

  const activeCount = classes.length;

  return (
    <>
      {/* 密码展示 */}
      <div className="relative mb-6 group">
        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center break-all text-2xl md:text-3xl font-mono text-slate-800 min-h-[100px] flex items-center justify-center shadow-inner relative overflow-hidden">
          {password || "请至少选择一种字符类型"}

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
          <label htmlFor="password-length" className="font-semibold text-slate-700">
            密码长度
          </label>
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

      {/* 字符类型 */}
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
          <span className="text-sm text-slate-700">特殊符号</span>
        </label>
      </div>

      {/* 符号范围：解决「某些系统不接受某些特殊字符」 */}
      {options.symbols && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">符号范围</span>
            <span className="text-xs text-slate-500">
              共 {SYMBOL_PRESETS[symbolPreset].chars.length} 个符号
            </span>
          </div>

          <div
            className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl"
            role="radiogroup"
            aria-label="符号范围"
          >
            {(Object.keys(SYMBOL_PRESETS) as SymbolPreset[]).map((key) => {
              const active = symbolPreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSymbolPreset(key)}
                  className={`py-1.5 text-sm rounded-lg transition-all ${
                    active
                      ? "bg-white text-indigo-600 font-semibold shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  {SYMBOL_PRESETS[key].label}
                </button>
              );
            })}
          </div>

          <div className="mt-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-600 break-all leading-relaxed">
            {SYMBOL_PRESETS[symbolPreset].chars.split("").join(" ")}
          </div>

          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            {SYMBOL_PRESETS[symbolPreset].hint}
          </p>
        </div>
      )}

      {/* 排除字符：应对个别系统仍然拒绝某个符号的情况 */}
      <div className="mb-6">
        <label htmlFor="exclude-chars" className="ui-label block mb-2">
          排除字符
          <span className="font-normal text-slate-500">（可选）</span>
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="exclude-chars"
            type="text"
            value={extraExclude}
            onChange={(e) => setExtraExclude(e.target.value)}
            placeholder="例如 & % #，留空则不额外排除"
            maxLength={40}
            spellCheck={false}
            autoComplete="off"
            className="ui-input font-mono flex-1"
          />
          <label className="flex items-center justify-center gap-2 cursor-pointer shrink-0 px-3 py-3 bg-white border border-slate-200 rounded-xl">
            <input
              type="checkbox"
              checked={excludeAmbiguous}
              onChange={(e) => toggleAmbiguous(e.target.checked)}
              className="ui-checkbox"
            />
            <span className="text-sm text-slate-700 whitespace-nowrap">排除易混淆字符</span>
          </label>
        </div>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          勾选「排除易混淆字符」会直接把 <span className="font-mono">I l 1 O 0 o |</span> 填入输入框，无需手动输入；反过来在输入框里删掉它们，勾选也会自动取消。输入框还可以再排除任意字符，例如某后台不允许 <span className="font-mono">&amp;</span> 或 <span className="font-mono">%</span>，填进去即可。
        </p>
      </div>

      {/* 提示 */}
      {emptiedClasses.length > 0 && (
        <p className="text-amber-600 text-sm mb-4">
          已排除全部「{emptiedClasses.join("、")}」字符，当前密码不会包含该类型。
        </p>
      )}

      {activeCount === 0 && (
        <p className="text-red-600 text-sm mb-4">
          所有字符类型都被排除了，请至少保留一种，或清空排除条件。
        </p>
      )}

      {length < activeCount && activeCount > 0 && (
        <p className="text-amber-600 text-sm mb-4">
          建议长度 ≥ 已选字符类型数量，保证每类都能出现
        </p>
      )}

      {/* 生成按钮 */}
      <button onClick={generatePassword} className="ui-btn ui-btn-primary ui-btn-block">
        <RefreshCw size={18} className="mr-2" />
        重新生成密码
      </button>

      <p className="flex items-start gap-2 text-xs text-slate-500 mt-4 leading-relaxed">
        <ShieldCheck size={14} className="shrink-0 mt-0.5 text-emerald-600" />
        使用浏览器 crypto.getRandomValues 生成，随机性来自系统熵源，且完全在本地计算，密码不会离开这台设备。
      </p>
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
