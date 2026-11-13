// app/cron/cron-utils.ts
// 标准 5 段 cron 的解析、语义描述与未来执行时间推算。纯函数，无依赖。
// 支持 * , - / 与星期 7(=周日)；不支持 L / W / # 等 Quartz 扩展。

export const FIELD_KEYS = ["minute", "hour", "day", "month", "dow"] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export const FIELD_META: Record<FieldKey, {
  name: string; min: number; max: number; label: string; unit: string;
}> = {
  minute: { name: "分钟", min: 0, max: 59, label: "分", unit: "分钟" },
  hour: { name: "小时", min: 0, max: 23, label: "点", unit: "小时" },
  day: { name: "日", min: 1, max: 31, label: "日", unit: "日" },
  month: { name: "月", min: 1, max: 12, label: "月", unit: "月" },
  dow: { name: "星期", min: 0, max: 7, label: "周", unit: "周" },
};

const DOW_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

export interface CronFields {
  minute: Set<number>;
  hour: Set<number>;
  day: Set<number>;
  month: Set<number>;
  dow: Set<number>;
  /** 原始字段是否为 *，用于实现 day / dow 的 OR 语义 */
  dayWild: boolean;
  dowWild: boolean;
}

/** 解析单个字段为取值集合；非法输入抛 Error */
export function parseField(raw: string, key: FieldKey): Set<number> {
  const { min, max } = FIELD_META[key];
  const values = new Set<number>();
  const text = raw.trim();
  if (!text) throw new Error(`${FIELD_META[key].name}字段不能为空`);

  for (const part of text.split(",")) {
    if (!part) throw new Error(`${FIELD_META[key].name}字段存在空的分段`);
    const [range, stepRaw, ...rest] = part.split("/");
    if (rest.length) throw new Error(`${FIELD_META[key].name}字段的 / 只能出现一次`);
    const step = stepRaw === undefined ? 1 : Number(stepRaw);
    if (!Number.isInteger(step) || step < 1) throw new Error(`${FIELD_META[key].name}字段步长必须为正整数`);

    let start: number;
    let end: number;
    if (range === "*" || range === "?") {
      start = min;
      end = max;
    } else if (range.includes("-")) {
      const [a, b, ...extra] = range.split("-");
      if (extra.length) throw new Error(`${FIELD_META[key].name}字段范围格式不正确`);
      start = Number(a);
      end = Number(b);
    } else {
      start = Number(range);
      // "5/10" 表示从 5 到最大值，每 10 一次
      end = stepRaw === undefined ? start : max;
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      throw new Error(`${FIELD_META[key].name}字段取值应在 ${min}~${max} 之间`);
    }
    for (let value = start; value <= end; value += step) values.add(key === "dow" && value === 7 ? 0 : value);
  }
  if (values.size === 0) throw new Error(`${FIELD_META[key].name}字段没有匹配值`);
  return values;
}

export function parseCron(expr: string): CronFields {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error("Cron 表达式必须是 5 段：分 时 日 月 周");
  const [minute, hour, day, month, dow] = parts;
  return {
    minute: parseField(minute, "minute"),
    hour: parseField(hour, "hour"),
    day: parseField(day, "day"),
    month: parseField(month, "month"),
    dow: parseField(dow, "dow"),
    dayWild: day === "*" || day === "?",
    dowWild: dow === "*" || dow === "?",
  };
}

function sorted(values: Set<number>): number[] {
  return [...values].sort((a, b) => a - b);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 等差数列（如 0,5,10…）优先概括成「每 N 分钟」 */
function evenStep(list: number[], span: number): number {
  if (list.length < 2 || list[0] !== 0) return 0;
  const step = list[1] - list[0];
  if (step < 2 || span % step !== 0 || list.length !== span / step) return 0;
  return list.every((value, index) => value === index * step) ? step : 0;
}

/** 把取值集合概括成一句中文 */
function describeValues(values: Set<number>, key: FieldKey): string {
  const { min, max, unit, label } = FIELD_META[key];
  const list = sorted(values);
  const span = max - min + 1;
  if (list.length === span) return `每${unit}`;
  if (key === "dow") return `每周${list.map((v) => DOW_NAMES[v]).join("、")}`;
  const step = evenStep(list, span);
  if (key === "minute") return step ? `每 ${step} 分钟` : list.length === 1
    ? `第 ${pad(list[0])} 分` : `第 ${list.map(pad).join("、")} 分`;
  if (key === "hour") return step ? `每 ${step} 小时` : `${list.map(pad).join("、")} 点`;
  if (key === "day") return `${list.join("、")} 日`;
  return `${list.join("、")}${label}`;
}

/** 人类可读的语义说明（尽量自然，不追求覆盖所有怪异组合） */
export function describeCron(fields: CronFields): string {
  const { minute, hour, day, month, dow, dayWild, dowWild } = fields;
  const scope: string[] = [];
  if (month.size !== 12) scope.push(describeValues(month, "month"));
  if (!dayWild && !dowWild) {
    scope.push(`${describeValues(day, "day")}或${describeValues(dow, "dow")}（满足其一）`);
  } else if (!dayWild) {
    scope.push(describeValues(day, "day"));
  } else if (!dowWild) {
    scope.push(describeValues(dow, "dow"));
  }
  const prefix = scope.join("、") || "每天";

  if (hour.size === 1 && minute.size === 1) {
    return `${prefix} ${pad(sorted(hour)[0])}:${pad(sorted(minute)[0])} 执行`;
  }
  const parts = scope.length ? [prefix] : [];
  if (hour.size !== 24) parts.push(describeValues(hour, "hour"));
  else if (minute.size !== 60) parts.push("每小时");
  if (minute.size !== 60) parts.push(describeValues(minute, "minute"));
  if (!parts.length) return "每分钟执行";
  if (parts.length === 2 && parts[0] === "每小时" && parts[1].startsWith("第")) {
    return `每小时的${parts[1]}执行`;
  }
  return `${parts.join("、")}执行`;
}

function matchDomDow(date: Date, fields: CronFields): boolean {
  const domHit = fields.day.has(date.getDate());
  const dowHit = fields.dow.has(date.getDay());
  // Vixie cron：日与周都受限时是「或」的关系；否则两个条件都要满足
  if (!fields.dayWild && !fields.dowWild) return domHit || dowHit;
  return domHit && dowHit;
}

export function matchesCron(date: Date, fields: CronFields): boolean {
  return fields.month.has(date.getMonth() + 1)
    && matchDomDow(date, fields)
    && fields.hour.has(date.getHours())
    && fields.minute.has(date.getMinutes());
}

/** 从 from 之后开始，按字段跳进找出接下来 count 次执行时间（按浏览器本地时区） */
export function nextRuns(expr: string, count = 5, from = new Date()): Date[] {
  const fields = parseCron(expr);
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  const results: Date[] = [];
  const deadline = from.getTime() + 4 * 366 * 24 * 60 * 60 * 1000;

  while (results.length < count && cursor.getTime() < deadline) {
    if (!fields.month.has(cursor.getMonth() + 1)) {
      cursor.setDate(1);
      cursor.setMonth(cursor.getMonth() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    if (!matchDomDow(cursor, fields)) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    if (!fields.hour.has(cursor.getHours())) {
      cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!fields.minute.has(cursor.getMinutes())) {
      cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
      continue;
    }
    results.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
  }
  return results;
}

export function formatDate(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const week = `周${DOW_NAMES[date.getDay()]}`;
  return `${day} ${time} ${week}`;
}

/* ---------------- 可视化配置 <-> 表达式 ---------------- */

export type FieldMode = "every" | "specific" | "interval" | "range";

export interface FieldConfig {
  mode: FieldMode;
  specific: number[];
  interval: number;
  intervalStart: number;
  rangeStart: number;
  rangeEnd: number;
}

export type CronConfig = Record<FieldKey, FieldConfig>;

export function defaultConfig(): CronConfig {
  const make = (key: FieldKey): FieldConfig => {
    const { min, max } = FIELD_META[key];
    return { mode: "every", specific: [min], interval: key === "minute" ? 5 : 1, intervalStart: min, rangeStart: min, rangeEnd: Math.min(max, min + 4) };
  };
  return {
    minute: make("minute"), hour: make("hour"), day: make("day"),
    month: make("month"), dow: make("dow"),
  };
}

export function configToExpr(config: CronConfig): string {
  return FIELD_KEYS.map((key) => {
    const { min, max } = FIELD_META[key];
    const item = config[key];
    switch (item.mode) {
      case "every": return "*";
      case "specific": {
        const values = sorted(new Set(item.specific.filter((v) => v >= min && v <= max)));
        return values.length ? values.join(",") : "*";
      }
      case "interval": {
        const step = Math.max(1, Math.min(max - min + 1, Math.floor(item.interval) || 1));
        const start = Math.max(min, Math.min(max, Math.floor(item.intervalStart) || min));
        return start === min ? `*/${step}` : `${start}/${step}`;
      }
      case "range": {
        const a = Math.max(min, Math.min(max, Math.floor(item.rangeStart)));
        const b = Math.max(a, Math.min(max, Math.floor(item.rangeEnd)));
        return `${a}-${b}`;
      }
    }
  }).join(" ");
}

/** 把手填表达式尽力还原成可视化配置 */
export function exprToConfig(expr: string): CronConfig {
  const config = defaultConfig();
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return config;
  FIELD_KEYS.forEach((key, index) => {
    const raw = parts[index];
    const { min, max } = FIELD_META[key];
    try {
      const values = sorted(parseField(raw, key));
      if (raw === "*" || raw === "?" || values.length === max - min + 1) {
        config[key].mode = "every";
      } else if (/^\*\/(\d+)$/.test(raw)) {
        config[key].mode = "interval";
        config[key].interval = Number(raw.split("/")[1]);
        config[key].intervalStart = min;
      } else if (/^(\d+)-(\d+)$/.test(raw)) {
        config[key].mode = "range";
        config[key].rangeStart = values[0];
        config[key].rangeEnd = values[values.length - 1];
      } else {
        config[key].mode = "specific";
        config[key].specific = values;
      }
    } catch {
      // 单字段解析失败时保持默认，不影响其他字段
    }
  });
  return config;
}

export const CRON_TEMPLATES: { name: string; expr: string }[] = [
  { name: "每分钟", expr: "* * * * *" },
  { name: "每 5 分钟", expr: "*/5 * * * *" },
  { name: "每 30 分钟", expr: "*/30 * * * *" },
  { name: "每小时整点", expr: "0 * * * *" },
  { name: "每天 09:00", expr: "0 9 * * *" },
  { name: "每天 02:00", expr: "0 2 * * *" },
  { name: "工作日 09:00", expr: "0 9 * * 1-5" },
  { name: "每周一 08:30", expr: "30 8 * * 1" },
  { name: "每月 1 号 00:00", expr: "0 0 1 * *" },
  { name: "每年 1 月 1 日", expr: "0 0 1 1 *" },
];
