"use client";

// src/app/timestamp/page.tsx
// Unix 时间戳 ⇄ 日期时间。秒 / 毫秒自动识别，同时给出本地时间、UTC、ISO 8601 与相对时间。

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Clock, RefreshCw } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, CopyButton, Notice } from "@/components/ui/ToolUI";

/* ============================ 工具函数 ============================ */

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

const pad = (n: number, len = 2) => String(n).padStart(len, "0");

/** 本地时区：2026-11-12 21:40:05 */
function formatLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** UTC：2026-11-12 13:40:05 */
function formatUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/** 带时区偏移的 ISO：2026-11-12T21:40:05+08:00 */
function formatIsoLocal(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${formatLocal(date).replace(" ", "T")}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** 时区名：UTC+08:00 */
function timezoneLabel(): string {
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const name = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${name}（UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}）`;
}

/** 相对时间：3 分钟前 / 2 小时后 */
function formatRelative(date: Date, base: number): string {
  const diff = date.getTime() - base;
  const abs = Math.abs(diff);
  const future = diff > 0;
  if (abs < 3000) return "刚刚";
  let text = "";
  if (abs < 60_000) text = `${Math.round(abs / 1000)} 秒`;
  else if (abs < 3_600_000) text = `${Math.round(abs / 60_000)} 分钟`;
  else if (abs < 86_400_000) text = `${Math.round(abs / 3_600_000)} 小时`;
  else if (abs < 2_592_000_000) text = `${Math.round(abs / 86_400_000)} 天`;
  else if (abs < 31_536_000_000) text = `${Math.round(abs / 2_592_000_000)} 个月`;
  else text = `${(abs / 31_536_000_000).toFixed(1)} 年`;
  return future ? `${text}后` : `${text}前`;
}

/** 把输入的时间戳归一到毫秒：≤ 1e11 视为秒 */
function toMs(raw: number): number {
  return Math.abs(raw) < 1e11 ? raw * 1000 : raw;
}

/** datetime-local 值（本地时间）→ Date */
function parseLocalInput(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/* ============================ 结果行 ============================ */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-kv">
      <span className="ui-kv-label">{label}</span>
      <span className="ui-kv-value font-mono flex items-center justify-end gap-1.5 min-w-0">
        <span className="truncate">{value}</span>
        <CopyButton value={value} label={`复制${label}`} size={15} />
      </span>
    </div>
  );
}

/* ============================ 页面 ============================ */

function TimestampCore() {
  const [now, setNow] = useState(0);
  const [raw, setRaw] = useState("");
  const [dateInput, setDateInput] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 实时时钟：首帧用微任务填充，避免在 effect 里同步 setState
  useEffect(() => {
    queueMicrotask(() => setNow(Date.now()));
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const currentSec = now ? String(Math.floor(now / 1000)) : "";
  const currentMs = now ? String(now) : "";

  /** 输入解析：纯数字按时间戳，其它尝试按日期字符串 */
  const parsedTs = useMemo(() => {
    const text = raw.trim();
    if (!text) return { date: null as Date | null, unit: "", error: "" };
    if (/^-?\d+(\.\d+)?$/.test(text)) {
      const num = Number(text);
      const date = new Date(toMs(num));
      if (Number.isNaN(date.getTime())) return { date: null, unit: "", error: "这个时间戳超出范围了" };
      return { date, unit: Math.abs(num) < 1e11 ? "秒" : "毫秒", error: "" };
    }
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return { date, unit: "日期", error: "" };
    return { date: null, unit: "", error: "既不是时间戳也不是可识别的日期" };
  }, [raw]);

  const inputDate = parseLocalInput(dateInput);

  const setNowInput = () => {
    const date = new Date();
    setRaw(String(Math.floor(date.getTime() / 1000)));
  };

  const shiftInput = (ms: number) => {
    const base = parsedTs.date ?? new Date();
    setRaw(String(Math.floor((base.getTime() + ms) / 1000)));
  };

  const applyToDateInput = (date: Date) => {
    setDateInput(toLocalInputValue(date));
  };

  return (
    <div className="space-y-6">
      {/* 当前时间 */}
      <div className="ui-display">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-slate-500 text-sm mb-1">当前 Unix 时间戳（秒）</div>
            <div className="text-3xl md:text-4xl font-mono font-bold text-slate-800 tabular-nums">
              {currentSec || "—"}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <CopyButton value={currentSec} label="复制秒级时间戳" size={18} />
            <CopyButton value={currentMs} label="复制毫秒时间戳" size={18} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="font-mono tabular-nums">毫秒 {currentMs || "—"}</span>
          <span className="font-mono">{now ? formatLocal(new Date(now)) : "—"}</span>
          <span>{timezoneLabel()}</span>
        </div>
      </div>

      {/* 时间戳 → 日期 */}
      <section className="pt-5 border-t border-slate-200">
        <div className="flex items-center justify-between mb-3 gap-3">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Clock size={16} className="text-indigo-600" />
            时间戳转日期
          </h2>
          {parsedTs.unit && (
            <span className="text-xs text-slate-500">
              识别为<b className="text-slate-700">{parsedTs.unit}</b>
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="ts-input"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            inputMode="numeric"
            spellCheck={false}
            autoComplete="off"
            placeholder="输入 10 位秒级或 13 位毫秒级时间戳"
            aria-label="时间戳输入"
            className="ui-input font-mono flex-1"
          />
          <Button variant="secondary" icon={RefreshCw} onClick={setNowInput}>
            现在
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          <button
            type="button"
            onClick={() => shiftInput(-3_600_000)}
            className="ui-btn ui-btn-ghost ui-btn-sm"
          >
            -1 小时
          </button>
          <button
            type="button"
            onClick={() => shiftInput(3_600_000)}
            className="ui-btn ui-btn-ghost ui-btn-sm"
          >
            +1 小时
          </button>
          <button
            type="button"
            onClick={() => shiftInput(86_400_000)}
            className="ui-btn ui-btn-ghost ui-btn-sm"
          >
            +1 天
          </button>
          <button
            type="button"
            onClick={() => shiftInput(604_800_000)}
            className="ui-btn ui-btn-ghost ui-btn-sm"
          >
            +7 天
          </button>
        </div>

        {parsedTs.error && (
          <Notice tone="error" className="mt-3">
            {parsedTs.error}
          </Notice>
        )}

        {parsedTs.date && (
          <div className="ui-kv-list mt-4">
            <Row label="本地时间" value={formatLocal(parsedTs.date)} />
            <Row label="UTC" value={formatUtc(parsedTs.date)} />
            <Row label="ISO 8601" value={parsedTs.date.toISOString()} />
            <Row label="ISO（带时区）" value={formatIsoLocal(parsedTs.date)} />
            <Row
              label="日期"
              value={`${parsedTs.date.getFullYear()} 年 ${parsedTs.date.getMonth() + 1} 月 ${parsedTs.date.getDate()} 日 ${WEEKDAYS[parsedTs.date.getDay()]}`}
            />
            <Row
              label="相对时间"
              value={formatRelative(parsedTs.date, now || parsedTs.date.getTime())}
            />
            <Row label="秒级时间戳" value={String(Math.floor(parsedTs.date.getTime() / 1000))} />
            <Row label="毫秒级时间戳" value={String(parsedTs.date.getTime())} />
          </div>
        )}
      </section>

      {/* 日期 → 时间戳 */}
      <section className="pt-5 border-t border-slate-200">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-3">
          <CalendarClock size={16} className="text-indigo-600" />
          日期转时间戳
        </h2>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="date-input"
            type="datetime-local"
            step={1}
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            aria-label="日期时间输入"
            className="ui-input flex-1"
          />
          <Button variant="secondary" onClick={() => applyToDateInput(new Date())}>
            现在
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const date = new Date();
              date.setHours(0, 0, 0, 0);
              applyToDateInput(date);
            }}
          >
            今天 0 点
          </Button>
        </div>

        {dateInput && !inputDate && (
          <Notice tone="error" className="mt-3">
            日期格式不完整，请补全后再看结果。
          </Notice>
        )}

        {inputDate && (
          <div className="ui-kv-list mt-4">
            <Row label="秒级时间戳" value={String(Math.floor(inputDate.getTime() / 1000))} />
            <Row label="毫秒级时间戳" value={String(inputDate.getTime())} />
            <Row label="对应 UTC" value={inputDate.toISOString()} />
            <Row label="相对现在" value={formatRelative(inputDate, now || inputDate.getTime())} />
          </div>
        )}

        <p className="text-xs text-slate-500 mt-3 leading-relaxed">
          输入按<b>浏览器本地时区</b>解析（当前为 {timezoneLabel()}）。若要按 UTC 换算，请改用上方时间戳输入。
        </p>
      </section>
    </div>
  );
}

export default function TimestampPage() {
  return (
    <ToolShell>
      <TimestampCore />
    </ToolShell>
  );
}
