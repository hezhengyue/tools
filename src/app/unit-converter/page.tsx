// app/unit-converter/page.tsx
"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Binary, Ruler, TriangleAlert } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import {
  Button, CopyButton, KeyRow, Notice, OutputBlock, Panel, Segmented,
} from "@/components/ui/ToolUI";
import {
  COMMON_BASES, findCategory, findUnit, formatInBase, formatNumber,
  parseInBase, UNIT_CATEGORIES,
} from "./unit-utils";

const BASE_OPTIONS = Array.from({ length: 35 }, (_, index) => index + 2);
const BASE_NAMES: Record<number, string> = { 2: "二进制", 8: "八进制", 10: "十进制", 16: "十六进制", 32: "三十二进制", 36: "三十六进制" };

export default function UnitConverterPage() {
  const [categoryKey, setCategoryKey] = useState("length");
  const [leftKey, setLeftKey] = useState("m");
  const [rightKey, setRightKey] = useState("ft");
  const [raw, setRaw] = useState("1");
  const [side, setSide] = useState<"left" | "right">("left");

  const [baseText, setBaseText] = useState("2026");
  const [fromBase, setFromBase] = useState(10);
  const [toBase, setToBase] = useState(16);

  const category = findCategory(categoryKey);
  const leftUnit = findUnit(category, leftKey);
  const rightUnit = findUnit(category, rightKey);
  const parsed = Number(raw);
  const valid = raw.trim() !== "" && Number.isFinite(parsed);
  const baseValue = valid
    ? (side === "left" ? leftUnit.toBase(parsed) : rightUnit.toBase(parsed))
    : 0;
  const leftValue = side === "left" ? raw : formatNumber(leftUnit.fromBase(baseValue));
  const rightValue = side === "right" ? raw : formatNumber(rightUnit.fromBase(baseValue));

  const baseResult = useMemo(() => {
    try {
      const value = parseInBase(baseText, fromBase);
      return {
        error: "",
        main: formatInBase(value, toBase),
        decimal: formatNumber(value),
        common: COMMON_BASES.map((base) => ({ base, value: formatInBase(value, base) })),
      };
    } catch (cause) {
      return {
        error: cause instanceof Error ? cause.message : "转换失败",
        main: "", decimal: "", common: [] as { base: number; value: string }[],
      };
    }
  }, [baseText, fromBase, toBase]);

  const switchCategory = (key: string) => {
    const next = findCategory(key);
    setCategoryKey(key);
    setLeftKey(next.units[0].key);
    setRightKey(next.units[1].key);
    setSide("left");
  };

  return (
    <ToolShell>
      <Panel icon={Ruler} title="单位换算">
        <div className="mb-4">
          <label htmlFor="unit-category" className="ui-label text-sm block mb-2">换算类别</label>
          <select
            id="unit-category"
            value={categoryKey}
            onChange={(event) => switchCategory(event.target.value)}
            className="ui-select"
          >
            {UNIT_CATEGORIES.map((item) => (
              <option key={item.key} value={item.key}>{item.label}（基准：{item.base}）</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
          <div>
            <label htmlFor="unit-left" className="ui-label text-sm block mb-2">数值 A</label>
            <input
              id="unit-left"
              value={leftValue}
              onChange={(event) => { setSide("left"); setRaw(event.target.value); }}
              inputMode="decimal"
              className="ui-input font-mono text-lg"
              aria-label="左侧数值"
            />
            <select
              aria-label="左侧单位"
              value={leftKey}
              onChange={(event) => setLeftKey(event.target.value)}
              className="ui-select mt-2"
            >
              {category.units.map((unit) => <option key={unit.key} value={unit.key}>{unit.label}</option>)}
            </select>
          </div>
          <Button
            variant="secondary"
            icon={ArrowLeftRight}
            aria-label="交换两侧单位"
            className="mb-0 sm:mb-1"
            onClick={() => {
              setLeftKey(rightKey);
              setRightKey(leftKey);
              setSide(side === "left" ? "right" : "left");
            }}
          >
            <span className="sm:hidden">交换两侧</span>
          </Button>
          <div>
            <label htmlFor="unit-right" className="ui-label text-sm block mb-2">数值 B</label>
            <input
              id="unit-right"
              value={rightValue}
              onChange={(event) => { setSide("right"); setRaw(event.target.value); }}
              inputMode="decimal"
              className="ui-input font-mono text-lg"
              aria-label="右侧数值"
            />
            <select
              aria-label="右侧单位"
              value={rightKey}
              onChange={(event) => setRightKey(event.target.value)}
              className="ui-select mt-2"
            >
              {category.units.map((unit) => <option key={unit.key} value={unit.key}>{unit.label}</option>)}
            </select>
          </div>
        </div>

        {!valid && <Notice tone="error" className="mt-3">请输入有效数字，支持小数与科学计数法（如 1.5e3）。</Notice>}

        <div className="mt-5 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-sm font-semibold text-slate-700">全部单位对照</span>
            <span className="text-xs text-slate-500">基准值 {formatNumber(baseValue)} {category.base}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
            {category.units.map((unit) => (
              <KeyRow
                key={unit.key}
                label={unit.label}
                value={valid ? formatNumber(unit.fromBase(baseValue)) : "—"}
                mono
              />
            ))}
          </div>
        </div>
      </Panel>

      <Panel icon={Binary} title="任意进制转换" className="mt-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
          <div>
            <label htmlFor="base-input" className="ui-label text-sm block mb-2">待转换数值</label>
            <input
              id="base-input"
              value={baseText}
              onChange={(event) => setBaseText(event.target.value)}
              spellCheck={false}
              className="ui-input font-mono"
              placeholder="例如 FF、1010、3.14"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
            <div>
              <label htmlFor="base-from" className="text-xs text-slate-500 block mb-1">源进制</label>
              <select id="base-from" value={fromBase} onChange={(event) => setFromBase(Number(event.target.value))} className="ui-select ui-input-sm">
                {BASE_OPTIONS.map((base) => <option key={base} value={base}>{base} 进制</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="base-to" className="text-xs text-slate-500 block mb-1">目标进制</label>
              <select id="base-to" value={toBase} onChange={(event) => setToBase(Number(event.target.value))} className="ui-select ui-input-sm">
                {BASE_OPTIONS.map((base) => <option key={base} value={base}>{base} 进制</option>)}
              </select>
            </div>
          </div>
          <div>
            <span className="ui-label text-sm block mb-2">{toBase} 进制结果</span>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={baseResult.main}
                aria-label="进制转换结果"
                className="ui-input font-mono text-lg bg-slate-50"
              />
              <CopyButton value={baseResult.main} label="复制结果" />
            </div>
          </div>
        </div>

        {baseResult.error ? (
          <Notice tone="error" className="mt-4"><TriangleAlert size={14} className="inline mr-1" />{baseResult.error}</Notice>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">快捷切换源进制：</span>
              <Segmented
                label="常用源进制"
                value={String(fromBase)}
                options={COMMON_BASES.map((base) => ({ value: String(base), label: `${base}` }))}
                onChange={(next) => setFromBase(Number(next))}
              />
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              {baseResult.common.map((item) => (
                <KeyRow key={item.base} label={BASE_NAMES[item.base]} value={item.value} mono />
              ))}
            </div>
            <Notice tone="info" className="mt-4">
              十进制值约为 {baseResult.decimal}。小数按乘基法迭代，最多保留 12 位；超过 2⁵³-1 的整数无法用 JavaScript 精确表示，会直接报错而不是给出错误答案。
            </Notice>
          </>
        )}
      </Panel>

      <div className="mt-5">
        <OutputBlock
          label="当前换算摘要"
          value={`${valid ? raw : "—"} ${leftUnit.label} = ${rightValue} ${rightUnit.label}
${baseText} (${fromBase} 进制) = ${baseResult.main || "—"} (${toBase} 进制)`}
          filename="unit-converter.txt"
          minHeight="min-h-[80px]"
          textareaClassName="text-xs"
        />
      </div>

      <Notice tone="tip" className="mt-5">
        时间类别的「月 / 年」按平均长度换算（月 30.44 天、儒略年 365.25 天），不用于日历日期计算；存储单位明确区分十进制（KB）与二进制（KiB）；马赫按海平面 15°C 音速 340.29 m/s 估算。
      </Notice>
    </ToolShell>
  );
}
