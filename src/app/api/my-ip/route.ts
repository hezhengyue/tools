// src/app/api/my-ip/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// 强制在 Edge Runtime 运行
export const runtime = 'edge'; 

export async function GET(request: Request) {
  const h = await headers();

  // 1. 获取 IP (保持你原有的逻辑)
  const ip =
    h.get("eo-connecting-ip") ||
    h.get("edge-inner-client-ip") ||
    h.get("cf-connecting-ip") ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "127.0.0.1";

  // 2. 从 Headers 中提取地理位置信息
  // 注意：Next.js 中 headers 键名通常转为小写
  const countryName = h.get("eo-ip-country-name") || "";
  const countryCode = h.get("eo-ip-country") || "";
  const regionName = h.get("eo-ip-region-name") || h.get("eo-ip-province-name") || "";
  const regionCode = h.get("eo-ip-region") || "";
  const cityName = h.get("eo-ip-city") || "";
  const latStr = h.get("eo-ip-latitude");
  const lonStr = h.get("eo-ip-longitude");
  const asnStr = h.get("eo-ip-asn");
  // 尝试获取运营商 (不同节点可能名称略有不同)
  const cisp = h.get("eo-ip-cisp") || h.get("eo-ip-isp") || "";

  // 3. 组装 Geo 对象
  // 只有当获取到国家名称时，才认为有地理位置数据
  let geo = null;
  if (countryName) {
    geo = {
      asn: asnStr ? parseInt(asnStr.replace(/AS/i, ''), 10) : 0,
      countryName,
      countryCodeAlpha2: countryCode,
      countryCodeAlpha3: "", // Header 通常不提供 Alpha3，留空
      countryCodeNumeric: "",
      regionName,
      regionCode,
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
    geo, // 返回组装好的对象
    asn: geo?.asn || null,
    clientIp: h.get("eo-connecting-ip") || ip,
  });
}