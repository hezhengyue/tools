// app/cron/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock, ListChecks, RefreshCw, Timer } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import {
  Badge, Button, CopyButton, Notice, Panel, Segmented,
} from "@/components/ui/ToolUI";
import {
  configToExpr, CRON_TEMPLATES, defaultConfig, describeCron, exprToConfig,
  FIELD_KEYS, FIELD_META, formatDate, nextRuns, parseCron,
  type CronConfig, type FieldKey, type FieldMode,
} from "./cron-utils";

const MODE_OPTIONS: { value: FieldMode; label: string }[] = [
  { value: "every", label: "每" },
  { value: "specific", label: "指定" },
  { value: "interval", label: "间隔" },
  { value: "range", label: "范围" },
];

const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function NumberInput({
  id, value, min, max, onChange, label,
}: { id: string; value: number; min: number; max: number; onChange: (next: number) => void; label: string }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-slate-600 min-w-0">
      {label}
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : min}
        onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value))))}
        className="ui-input ui-input-sm w-20 font-mono"
      />
    </label>
  );
}

function FieldCard({
  fieldKey, exprPart, config, onConfigChange,
}: {
  fieldKey: FieldKey;
  exprPart: string;
  config: CronConfig;
  onConfigChange: (next: CronConfig) => void;
}) {
  const meta = FIELD_META[fieldKey];
  const item = config[fieldKey];
  const update = (patch: Partial<CronConfig[FieldKey]>) => {
    onConfigChange({ ...config, [fieldKey]: { ...item, ...patch } });
  };
  const values = Array.from({ length: meta.max - meta.min + 1 }, (_, index) => meta.min + index);
  const chipLabel = (value: number) => fieldKey === "dow" && value <= 6
    ? WEEK_LABELS[value]
    : String(value).padStart(2, "0");

  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-sm font-semibold text-slate-700 shrink-0">
          {meta.name}
          <code className="ml-2 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-mono text-xs">{exprPart}</code>
        </span>
        <Segmented
          label={`${meta.name}字段模式`}
          value={item.mode}
          options={MODE_OPTIONS}
          onChange={(mode) => update({ mode })}
        />
      </div>

      {item.mode === "specific" && (
        <div className="grid grid-cols-8 sm:grid-cols-10 gap-1 max-h-36 overflow-y-auto pr-1">
          {values.map((value) => {
            const active = item.specific.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => update({
                  specific: active
                    ? item.specific.filter((v) => v !== value)
                    : [...item.specific, value].sort((a, b) => a - b),
                })}
                className={`py-1 text-xs font-mono rounded-lg border transition-colors ${
                  active
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                }`}
              >
                {chipLabel(value)}
              </button>
            );
          })}
        </div>
      )}

      {item.mode === "interval" && (
        <div className="flex flex-wrap items-center gap-4">
          <NumberInput
            id={`cron-${fieldKey}-start`}
            label="从"
            value={item.intervalStart}
            min={meta.min}
            max={meta.max}
            onChange={(intervalStart) => update({ intervalStart })}
          />
          <NumberInput
            id={`cron-${fieldKey}-step`}
            label={`开始，每隔`}
            value={item.interval}
            min={1}
            max={meta.max - meta.min + 1}
            onChange={(interval) => update({ interval })}
          />
          <span className="text-sm text-slate-500">{meta.unit}执行一次</span>
        </div>
      )}

      {item.mode === "range" && (
        <div className="flex flex-wrap items-center gap-4">
          <NumberInput
            id={`cron-${fieldKey}-from`}
            label="从"
            value={item.rangeStart}
            min={meta.min}
            max={meta.max}
            onChange={(rangeStart) => update({ rangeStart })}
          />
          <NumberInput
            id={`cron-${fieldKey}-to`}
            label="到"
            value={item.rangeEnd}
            min={meta.min}
            max={meta.max}
            onChange={(rangeEnd) => update({ rangeEnd })}
          />
          <span className="text-sm text-slate-500">范围内每次都执行</span>
        </div>
      )}

      {item.mode === "every" && (
        <p className="text-xs text-slate-500">不限制，{meta.min === 0 && meta.max === 59 ? "每分钟" : `每${meta.unit}`}都匹配。</p>
      )}
    </div>
  );
}

export default function CronPage() {
  const [config, setConfig] = useState<CronConfig>(defaultConfig);
  const [expr, setExpr] = useState("*/5 * * * *");
  const [base, setBase] = useState(0);

  useEffect(() => {
    queueMicrotask(() => setBase(Date.now()));
    const timer = setInterval(() => setBase(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const result = useMemo(() => {
    try {
      const fields = parseCron(expr);
      return {
        error: "",
        description: describeCron(fields),
        runs: base ? nextRuns(expr, 5, new Date(base)).map(formatDate) : [],
      };
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : "表达式不合法", description: "", runs: [] as string[] };
    }
  }, [expr, base]);

  const applyConfig = (next: CronConfig) => {
    setConfig(next);
    setExpr(configToExpr(next));
  };

  const parts = expr.trim().split(/\s+/);

  return (
    <ToolShell>
      <Panel icon={Clock} title="Cron 表达式">
        <div className="flex items-center gap-2">
          <input
            id="cron-expr"
            value={expr}
            onChange={(event) => setExpr(event.target.value)}
            spellCheck={false}
            placeholder="分 时 日 月 周，例如 0 9 * * 1-5"
            className="ui-input font-mono text-base tracking-wide"
            aria-label="Cron 表达式"
          />
          <CopyButton value={expr} label="复制表达式" />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <span className="text-xs text-slate-500">5 段：分 0-59 · 时 0-23 · 日 1-31 · 月 1-12 · 周 0-6（0 = 周日）</span>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setConfig(exprToConfig(expr))}>
            解析到下方配置
          </Button>
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => setBase(Date.now())}>刷新时间</Button>
        </div>
        {result.error && <Notice tone="error" className="mt-3">{result.error}</Notice>}
      </Panel>

      <Panel icon={ListChecks} title="常用模板" className="mt-5">
        <div className="flex flex-wrap gap-2">
          {CRON_TEMPLATES.map((template) => (
            <Button
              key={template.name}
              variant={expr === template.expr ? "primary" : "secondary"}
              size="sm"
              onClick={() => { setExpr(template.expr); setConfig(exprToConfig(template.expr)); }}
            >
              {template.name}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel icon={Timer} title="可视化配置" className="mt-5">
        <div className="space-y-3">
          {FIELD_KEYS.map((key, index) => (
            <FieldCard
              key={key}
              fieldKey={key}
              exprPart={parts[index] ?? "*"}
              config={config}
              onConfigChange={applyConfig}
            />
          ))}
        </div>
      </Panel>

      <Panel icon={CalendarClock} title="执行计划" className="mt-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge className="bg-indigo-50 text-indigo-700">{result.error ? "表达式无效" : "本地时区"}</Badge>
          <span className="text-sm text-slate-700">{result.error || result.description}</span>
        </div>
        {result.runs.length > 0 ? (
          <ol className="space-y-2">
            {result.runs.map((run, index) => (
              <li key={run} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold">
                  {index + 1}
                </span>
                <span className="font-mono text-slate-700">{run}</span>
              </li>
            ))}
          </ol>
        ) : (
          <Notice tone={result.error ? "error" : "info"}>
            {result.error ? "修正表达式后即可预览执行时间。" : "正在计算…或该表达式在 4 年内没有匹配的时间。"}
          </Notice>
        )}
      </Panel>

      <Notice tone="tip" className="mt-5">
        采用标准 5 段 Linux cron 语法，支持 <code>* , - /</code>。当「日」和「周」都受限时按任一满足执行（Vixie cron 行为）；不支持 Quartz 的 L / W / # 等扩展。执行时间按浏览器本地时区计算，不含秒字段。
      </Notice>
    </ToolShell>
  );
}
