// src/app/api/my-ip/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = 'edge'; 

export async function GET(request: Request) {
  const h = await headers();

  // 1. 获取 IP (保持原有逻辑)
  const ip =
    h.get("eo-connecting-ip") ||
    h.get("edge-inner-client-ip") ||
    h.get("cf-connecting-ip") ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "127.0.0.1";

  // 2. 调试：收集所有可能包含地理位置信息的 Headers
  const debugHeaders: Record<string, string> = {};
  h.forEach((value, key) => {
    // 只过滤出包含 eo, geo, ip, country, city, region, forwarded, real 等关键字的 header
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('eo') || 
      lowerKey.includes('geo') || 
      lowerKey.includes('ip') || 
      lowerKey.includes('country') || 
      lowerKey.includes('city') || 
      lowerKey.includes('region') || 
      lowerKey.includes('forwarded') || 
      lowerKey.includes('real')
    ) {
      debugHeaders[key] = value;
    }
  });

  // 3. 尝试从常见的 Header 中提取地理位置 (兼容多种可能的命名)
  const countryName = h.get("eo-ip-country-name") || h.get("x-eo-ip-country-name") || h.get("cf-ipcountry") || "";
  const countryCode = h.get("eo-ip-country") || h.get("x-eo-ip-country") || "";
  const regionName = h.get("eo-ip-region-name") || h.get("x-eo-ip-region-name") || "";
  const cityName = h.get("eo-ip-city") || h.get("x-eo-ip-city") || "";
  const latStr = h.get("eo-ip-latitude") || h.get("x-eo-ip-latitude") || "";
  const lonStr = h.get("eo-ip-longitude") || h.get("x-eo-ip-longitude") || "";
  const asnStr = h.get("eo-ip-asn") || h.get("x-eo-ip-asn") || "";
  const cisp = h.get("eo-ip-cisp") || h.get("eo-ip-isp") || "";

  let geo = null;
  if (countryName || cityName) {
    geo = {
      asn: asnStr ? parseInt(asnStr.replace(/AS/i, ''), 10) : 0,
      countryName,
      countryCodeAlpha2: countryCode,
      countryCodeAlpha3: "",
      countryCodeNumeric: "",
      regionName,
      regionCode: "",
      cityName,
      latitude: latStr ? parseFloat(latStr) : 0,
      longitude: lonStr ? parseFloat(lonStr) : 0,
      cisp,
    };
  }

  return NextResponse.json({
    success: true,
    ip,
    local: ip === "127.0.0.1" || ip === "::1",
    geo,
    asn: geo?.asn || null,
    clientIp: h.get("eo-connecting-ip") || ip,
    // 👇 关键调试信息：返回所有相关的 Headers
    debugHeaders 
  });
}