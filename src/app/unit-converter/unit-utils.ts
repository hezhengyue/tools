// app/unit-converter/unit-utils.ts
// 单位换算表与任意进制换算。全部为纯函数，数值一律以「基准单位」为中介。

export interface UnitDef {
  key: string;
  label: string;
  /** 该单位值 → 基准单位值 */
  toBase: (value: number) => number;
  /** 基准单位值 → 该单位值 */
  fromBase: (value: number) => number;
}

export interface UnitCategory {
  key: string;
  label: string;
  base: string;
  units: UnitDef[];
}

function linear(key: string, label: string, factor: number): UnitDef {
  return { key, label, toBase: (v) => v * factor, fromBase: (v) => v / factor };
}

/** 温度：以摄氏度为基准，其余按公式换算 */
function temperature(key: string, label: string, toC: (v: number) => number, fromC: (v: number) => number): UnitDef {
  return { key, label, toBase: toC, fromBase: fromC };
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    key: "length", label: "长度", base: "米 (m)",
    units: [
      linear("m", "米 m", 1), linear("km", "千米 km", 1000), linear("cm", "厘米 cm", 0.01),
      linear("mm", "毫米 mm", 0.001), linear("um", "微米 μm", 1e-6), linear("nm", "纳米 nm", 1e-9),
      linear("in", "英寸 in", 0.0254), linear("ft", "英尺 ft", 0.3048), linear("yd", "码 yd", 0.9144),
      linear("mi", "英里 mi", 1609.344), linear("nmi", "海里 nmi", 1852),
      linear("li", "市里", 500), linear("chi", "市尺", 1 / 3), linear("cun", "市寸", 1 / 30),
    ],
  },
  {
    key: "mass", label: "质量 / 重量", base: "千克 (kg)",
    units: [
      linear("kg", "千克 kg", 1), linear("g", "克 g", 0.001), linear("mg", "毫克 mg", 1e-6),
      linear("t", "吨 t", 1000), linear("lb", "磅 lb", 0.45359237), linear("oz", "盎司 oz", 0.028349523125),
      linear("st", "英石 st", 6.35029318), linear("jin", "市斤", 0.5), linear("liang", "市两", 0.05),
      linear("qian", "市钱", 0.005),
    ],
  },
  {
    key: "temperature", label: "温度", base: "摄氏度 (°C)",
    units: [
      temperature("c", "摄氏 °C", (v) => v, (v) => v),
      temperature("f", "华氏 °F", (v) => (v - 32) * 5 / 9, (v) => v * 9 / 5 + 32),
      temperature("k", "开尔文 K", (v) => v - 273.15, (v) => v + 273.15),
      temperature("r", "兰氏 °R", (v) => (v - 491.67) * 5 / 9, (v) => v * 9 / 5 + 491.67),
    ],
  },
  {
    key: "area", label: "面积", base: "平方米 (m²)",
    units: [
      linear("m2", "平方米 m²", 1), linear("km2", "平方千米 km²", 1e6),
      linear("cm2", "平方厘米 cm²", 1e-4), linear("mm2", "平方毫米 mm²", 1e-6),
      linear("ha", "公顷 ha", 10000), linear("mu", "亩", 2000 / 3), linear("a", "公亩 a", 100),
      linear("ft2", "平方英尺 ft²", 0.09290304), linear("acre", "英亩 acre", 4046.8564224),
    ],
  },
  {
    key: "volume", label: "体积 / 容积", base: "升 (L)",
    units: [
      linear("l", "升 L", 1), linear("ml", "毫升 mL", 0.001), linear("m3", "立方米 m³", 1000),
      linear("cm3", "立方厘米 cm³", 0.001), linear("gal", "美制加仑 gal", 3.785411784),
      linear("qt", "美制夸脱 qt", 0.946352946), linear("pt", "美制品脱 pt", 0.473176473),
      linear("cup", "美制杯 cup", 0.2365882365), linear("floz", "美制液量盎司 fl oz", 0.0295735295625),
      linear("bbl", "石油桶 bbl", 158.987294928),
    ],
  },
  {
    key: "time", label: "时间", base: "秒 (s)",
    units: [
      linear("s", "秒 s", 1), linear("ms", "毫秒 ms", 0.001), linear("us", "微秒 μs", 1e-6),
      linear("ns", "纳秒 ns", 1e-9), linear("min", "分钟 min", 60), linear("h", "小时 h", 3600),
      linear("d", "天 d", 86400), linear("w", "周 w", 604800),
      linear("mo", "月（平均 30.44 天）", 2629746), linear("y", "年（儒略年 365.25 天）", 31557600),
    ],
  },
  {
    key: "data", label: "数据存储", base: "比特 (bit)",
    units: [
      linear("bit", "比特 bit", 1), linear("B", "字节 B", 8),
      linear("KB", "千字节 KB (10³)", 8000), linear("KiB", "千字节 KiB (2¹⁰)", 8192),
      linear("MB", "兆字节 MB (10⁶)", 8e6), linear("MiB", "兆字节 MiB (2²⁰)", 8 * 1024 * 1024),
      linear("GB", "吉字节 GB (10⁹)", 8e9), linear("GiB", "吉字节 GiB (2³⁰)", 8 * 1024 ** 3),
      linear("TB", "太字节 TB (10¹²)", 8e12), linear("TiB", "太字节 TiB (2⁴⁰)", 8 * 1024 ** 4),
    ],
  },
  {
    key: "speed", label: "速度", base: "米/秒 (m/s)",
    units: [
      linear("ms", "米/秒 m/s", 1), linear("kmh", "千米/时 km/h", 1 / 3.6),
      linear("mph", "英里/时 mph", 0.44704), linear("knot", "节 kn", 1852 / 3600),
      linear("fts", "英尺/秒 ft/s", 0.3048), linear("mach", "马赫（海平面 15°C）", 340.29),
    ],
  },
  {
    key: "pressure", label: "压强", base: "帕斯卡 (Pa)",
    units: [
      linear("pa", "帕 Pa", 1), linear("kpa", "千帕 kPa", 1000), linear("mpa", "兆帕 MPa", 1e6),
      linear("bar", "巴 bar", 1e5), linear("mbar", "毫巴 mbar", 100),
      linear("atm", "标准大气压 atm", 101325), linear("mmhg", "毫米汞柱 mmHg", 133.322387415),
      linear("psi", "磅力/平方英寸 psi", 6894.757293168),
    ],
  },
];

export function findCategory(key: string): UnitCategory {
  return UNIT_CATEGORIES.find((item) => item.key === key) ?? UNIT_CATEGORIES[0];
}

export function findUnit(category: UnitCategory, key: string): UnitDef {
  return category.units.find((item) => item.key === key) ?? category.units[0];
}

/** 按有效数字格式化，避免 1e-9 / 过长浮点尾巴 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e15 || abs < 1e-9) return value.toExponential(8).replace(/\.?0+e/, "e");
  const digits = abs >= 1000 ? 6 : abs >= 1 ? 8 : 10;
  return Number(value.toPrecision(digits)).toString();
}

/* ---------------- 任意 2~36 进制 ---------------- */

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function charToDigit(char: string): number {
  const upper = char.toUpperCase();
  const value = DIGITS.indexOf(upper);
  if (value < 0) throw new Error(`字符「${char}」不是合法数字`);
  return value;
}

/** 解析任意进制的数（支持负号与小数），返回 Number；超出 2^53 会有精度损失 */
export function parseInBase(text: string, base: number): number {
  if (!Number.isInteger(base) || base < 2 || base > 36) throw new Error("进制必须在 2~36 之间");
  const raw = text.trim().toUpperCase();
  if (!raw) throw new Error("请输入要转换的数值");
  const negative = raw.startsWith("-");
  const body = negative ? raw.slice(1) : raw;
  const [intPart, fracPart = "", ...rest] = body.split(".");
  if (rest.length || !intPart) throw new Error("数值格式不正确");

  let result = 0;
  for (const char of intPart) {
    const digit = charToDigit(char);
    if (digit >= base) throw new Error(`字符「${char}」不属于 ${base} 进制`);
    result = result * base + digit;
  }
  let place = 1 / base;
  for (const char of fracPart) {
    const digit = charToDigit(char);
    if (digit >= base) throw new Error(`字符「${char}」不属于 ${base} 进制`);
    result += digit * place;
    place /= base;
  }
  if (!Number.isSafeInteger(result) && result > Number.MAX_SAFE_INTEGER) {
    throw new Error("数值超出 JavaScript 安全整数范围（2⁵³-1），无法精确表示");
  }
  return negative ? -result : result;
}

/** 把数字格式化为任意进制字符串，小数最多 12 位 */
export function formatInBase(value: number, base: number, maxFraction = 12): string {
  if (!Number.isInteger(base) || base < 2 || base > 36) throw new Error("进制必须在 2~36 之间");
  if (!Number.isFinite(value)) throw new Error("数值无效");
  if (value === 0) return "0";
  const negative = value < 0;
  const rest = Math.abs(value);
  let intPart = Math.floor(rest);
  let intText = "";
  if (intPart === 0) intText = "0";
  while (intPart > 0) {
    intText = DIGITS[intPart % base] + intText;
    intPart = Math.floor(intPart / base);
  }
  let fracText = "";
  let fraction = rest - Math.floor(rest);
  while (fraction > 0 && fracText.length < maxFraction) {
    fraction *= base;
    const digit = Math.floor(fraction + 1e-10);
    fracText += DIGITS[digit];
    fraction -= digit;
    if (fraction < 1e-12) break;
  }
  return `${negative ? "-" : ""}${intText}${fracText ? `.${fracText}` : ""}`;
}

export const COMMON_BASES = [2, 8, 10, 16, 32, 36];
