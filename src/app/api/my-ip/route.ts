// src/app/api/my-ip/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * 查询访客公网 IP 与归属地。
 *
 * 不再依赖 EdgeOne 的私有请求头（eo-connecting-geo 默认并不会下发，
 * 且需控制台手动开启、只含国家码），因此本地开发、Vercel、EdgeOne Pages、
 * 自有服务器上都能正常工作。策略：
 *   1. 从通用请求头取真实客户端 IP（EdgeOne / Cloudflare / 反向代理通用）。
 *   2. 平台若注入了完整的地理位置头，优先使用（零额外请求）。
 *   3. 否则由服务端查询公共 IP 库：ipwho.is -> ipapi.co 双回退。
 * 服务端发请求，避免浏览器 CORS，也不会把第三方接口暴露给前端。
 *
 * 注意：这些 IP / geo 头在直连部署时客户端可伪造。本接口只返回公开归属地数据、
 * 目标域名固定，且对 IP 做白名单校验，但不应作为鉴权或计费依据；
 * 下面的轻量限流用于缓解对上游配额的滥用。
 */

export interface GeoInfo {
  asn: number | null;
  countryName: string;
  countryCodeAlpha2: string;
  regionName: string;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
  cisp: string;
  timezone: string;
}

// 常见国家/地区中文名。涉及中国领土一律使用规范表述。
const COUNTRY_CN: Record<string, string> = {
  CN: "中国",
  HK: "中国香港",
  MO: "中国澳门",
  TW: "中国台湾",
  JP: "日本",
  KR: "韩国",
  SG: "新加坡",
  MY: "马来西亚",
  TH: "泰国",
  VN: "越南",
  US: "美国",
  GB: "英国",
  DE: "德国",
  FR: "法国",
  CA: "加拿大",
  AU: "澳大利亚",
  RU: "俄罗斯",
  IN: "印度",
};

function countryName(name: string, code: string): string {
  return COUNTRY_CN[code] || name || code || "-";
}

/** 平台请求头 / IP 库里的占位值（Unknown、N/A 等）统一视为空 */
function clean(value: unknown): string {
  const v = String(value ?? "").trim();
  return /^(unknown|null|undefined|n\/a|none|-)$/i.test(v) ? "" : v;
}

function toNumber(value: unknown): number | null {
  // 0 是合法经纬度（赤道 / 本初子午线），不能当缺失值丢弃
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 只接受合法的 IPv4 / IPv6 字面量，且排除私有与保留地址。
 * 请求头来自客户端，不能把任意文本拼进外部查询 URL（防止被当作 IP 查询代理 / 路径注入）。
 */
function isPublicIp(ip: string): boolean {
  if (!ip || ip.length > 64) return false;
  const value = ip.trim().replace(/^\[|\]$/g, "").replace(/^::ffff:/i, "");

  const v4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const parts = v4.slice(1, 5).map(Number);
    if (parts.some((n) => n > 255)) return false;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // 运营商 CGNAT
    if (a === 192 && b === 0 && parts[2] === 0) return false; // 192.0.0.0/24
    if (a === 198 && (b === 18 || b === 19)) return false; // 基准测试段
    return true;
  }

  // IPv6：只允许十六进制与冒号（含 %zone 的形式直接拒绝）
  if (!value.includes(":") || !/^[0-9a-fA-F:.]+$/.test(value)) return false;
  const lower = value.toLowerCase();
  if (lower === "::" || lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd")) return false;
  if (/^fe[89ab]/.test(lower)) return false; // fe80::/10 链路本地
  return true;
}

function getClientIp(h: Headers): string {
  const xff = (h.get("x-forwarded-for") || "").split(",")[0].trim();
  const candidates = [
    h.get("eo-connecting-ip"),
    h.get("cf-connecting-ip"),
    h.get("true-client-ip"),
    h.get("x-real-ip"),
    xff,
  ];
  for (const value of candidates) {
    let ip = (value || "").trim();
    // 反代偶尔写成 1.2.3.4:5678，去掉端口（仅 IPv4，避免误伤 IPv6 尾段）
    if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(":"));
    if (isPublicIp(ip)) return ip;
  }
  return "";
}

/** 兼容平台手动开启的地理位置回源头（key=value 串或 JSON） */
function parseGeoHeader(h: Headers): GeoInfo | null {
  try {
    const raw = h.get("eo-connecting-geo") || h.get("eo-client-geo") || "";
    const countryHeader = h.get("eo-client-ipcountry") || h.get("cf-ipcountry") || "";
    // 无原型 + 字段白名单：JSON 里的 __proto__ 不能污染，非字符串值不会让 .trim() 抛错
    const kv: Record<string, string> = Object.create(null);
    const put = (key: string, value: unknown) => {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) return;
      if (typeof value === "string" || typeof value === "number") kv[key] = String(value);
    };

    if (raw) {
      const decoded = decodeURIComponent(raw);
      if (decoded.trim().startsWith("{")) {
        const parsed: unknown = JSON.parse(decoded);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          for (const [key, value] of Object.entries(parsed)) put(key, value);
        }
      } else {
        const re = /(\w+)\s*=\s*("([^"]*)"|'([^']*)'|(\S+))/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(decoded)) !== null) put(m[1], m[3] ?? m[4] ?? m[5] ?? "");
      }
    }

    const code = clean(kv.nation_alpha2 || kv.country_code || kv.countryCode || countryHeader).toUpperCase();
    const name = clean(kv.nation_name || kv.country_name || kv.country);
    const city = clean(kv.city_name || kv.city);
    if (!code && !name && !city) return null;

    return {
      asn: toNumber(kv.asn),
      countryName: countryName(name, code),
      countryCodeAlpha2: code || "-",
      regionName: clean(kv.region_name || kv.region),
      cityName: city,
      latitude: toNumber(kv.latitude ?? kv.lat),
      longitude: toNumber(kv.longitude ?? kv.lon),
      cisp: clean(kv.network_operator || kv.isp || kv.org),
      timezone: clean(kv.timezone),
    };
  } catch {
    // 头部格式不认识就忽略，继续走公共 IP 库；绝不能让一个畸形头把接口打成 500
    return null;
  }
}

// 单实例内存限流：防止接口被当作任意公网 IP 的免费查询代理而耗尽上游配额。
// Serverless 多实例下只是尽力而为，不替代网关层限流。
const RATE_WINDOW = 60_000;
const RATE_LIMIT = 30;
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + RATE_WINDOW });
    if (hits.size > 500) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

interface IpwhoResponse {
  success?: boolean;
  ip?: string;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  connection?: { asn?: number; isp?: string; org?: string };
  timezone?: { id?: string };
}

interface IpapiResponse {
  error?: boolean;
  ip?: string;
  country_name?: string;
  country_code?: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  asn?: string | number;
  org?: string;
  timezone?: string;
}

function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  return typeof AbortSignal.any === "function" ? AbortSignal.any([a, b]) : b;
}

async function fetchJson<T>(url: string, budget: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: combineSignals(AbortSignal.timeout(4000), budget),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type LookupResult = { geo: GeoInfo; ip: string; source: string };

/** ip 为空（本地开发或拿不到访客 IP）时，接口返回的是服务器出口公网 IP */
async function lookup(ip: string): Promise<LookupResult | null> {
  // target 只可能是通过 isPublicIp 白名单的 IP 字面量；再编码一层彻底杜绝路径注入
  const target = isPublicIp(ip) ? encodeURIComponent(ip) : "";
  // 两源串行仍要有总预算，否则 4s + 4s 加上调度会顶到平台函数上限
  const controller = new AbortController();
  const budget = setTimeout(() => controller.abort(), 8000);

  try {
    // 主数据源：ipwho.is，免费、HTTPS、无需 key
    const a = await fetchJson<IpwhoResponse>(`https://ipwho.is/${target}`, controller.signal);
    if (a?.success) {
      const code = clean(a.country_code).toUpperCase();
      return {
        ip: isPublicIp(String(a.ip || "")) ? String(a.ip) : ip,
        source: "ipwho.is",
        geo: {
          asn: toNumber(a.connection?.asn),
          countryName: countryName(clean(a.country), code),
          countryCodeAlpha2: code || "-",
          regionName: clean(a.region),
          cityName: clean(a.city),
          latitude: toNumber(a.latitude),
          longitude: toNumber(a.longitude),
          cisp: clean(a.connection?.isp || a.connection?.org),
          timezone: clean(a.timezone?.id),
        },
      };
    }

    // 备用数据源：ipapi.co
    const b = await fetchJson<IpapiResponse>(`https://ipapi.co/${target}/json/`, controller.signal);
    if (b && !b.error && b.ip) {
      const code = clean(b.country_code || b.country).toUpperCase();
      return {
        ip: isPublicIp(String(b.ip)) ? String(b.ip) : ip,
        source: "ipapi.co",
        geo: {
          asn: toNumber(typeof b.asn === "string" ? b.asn.replace(/^AS/i, "") : b.asn),
          countryName: countryName(clean(b.country_name), code),
          countryCodeAlpha2: code || "-",
          regionName: clean(b.region),
          cityName: clean(b.city),
          latitude: toNumber(b.latitude),
          longitude: toNumber(b.longitude),
          cisp: clean(b.org),
          timezone: clean(b.timezone),
        },
      };
    }

    return null;
  } finally {
    clearTimeout(budget);
  }
}

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  try {
    const h = await headers();
    const headerIp = getClientIp(h);
    if (rateLimited(headerIp || "unknown")) {
      return NextResponse.json(
        { success: false, error: "请求过于频繁，请稍后再试" },
        { status: 429, headers: NO_STORE }
      );
    }
    const local = !headerIp;

    const platformGeo = parseGeoHeader(h);
    // 只有平台给了完整信息（城市 + 经纬度）才直接使用，避免仅国家码时信息残缺
    const platformComplete =
      platformGeo && !!platformGeo.cityName && platformGeo.latitude !== null;

    let geo: GeoInfo | null = platformComplete ? platformGeo : null;
    let source = platformComplete ? "cdn" : "";
    let ip = headerIp;

    if (!geo) {
      const result = await lookup(headerIp);
      if (result) {
        geo = result.geo;
        source = result.source;
        ip = ip || result.ip; // 本地开发时展示出网公网 IP
      } else if (platformGeo) {
        geo = platformGeo;
        source = "cdn";
      }
    }

    return NextResponse.json(
      {
        success: true,
        ip: ip || "未知",
        local,
        clientIp: ip,
        geo,
        asn: geo?.asn ?? null,
        source: source || null,
        error: geo ? null : "暂时无法获取地理位置信息，请稍后重试",
      },
      { headers: NO_STORE }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "暂时无法获取地理位置信息，请稍后重试" },
      { status: 200, headers: NO_STORE }
    );
  }
}
