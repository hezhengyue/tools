// src/app/api/my-ip/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = 'edge'; 

// 解析 eo-connecting-geo 的键值对字符串
function parseGeoString(geoStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  // 匹配键值对，支持带引号的值（如 nation_name="China"）
  const regex = /(\w+)=("([^"]*)"|(\S+))/g;
  let match;
  
  while ((match = regex.exec(geoStr)) !== null) {
    const key = match[1];
    const value = match[3] || match[4]; // 优先取带引号的值，否则取不带引号的
    result[key] = value;
  }
  
  return result;
}

export async function GET(request: Request) {
  const h = await headers();

  // 1. 获取 IP
  const ip =
    h.get("eo-connecting-ip") ||
    h.get("edge-inner-client-ip") ||
    h.get("cf-connecting-ip") ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "127.0.0.1";

  // 2. 获取并解析 eo-connecting-geo
  const geoStr = h.get("eo-connecting-geo");
  let geo = null;
  
  if (geoStr) {
    try {
      // 先 URL 解码
      const decoded = decodeURIComponent(geoStr);
      // 解析键值对
      const geoData = parseGeoString(decoded);
      
      // 组装成前端需要的格式
      geo = {
        asn: parseInt(geoData.asn || '0', 10),
        countryName: geoData.nation_name || '',
        countryCodeAlpha2: geoData.nation_alpha2 || '',
        countryCodeAlpha3: geoData.nation_alpha3 || '',
        countryCodeNumeric: geoData.nation_numeric || '',
        regionName: geoData.region_name || '',
        regionCode: geoData.region_code || '',
        cityName: geoData.city_name || '',
        latitude: parseFloat(geoData.latitude || '0'),
        longitude: parseFloat(geoData.longitude || '0'),
        cisp: geoData.network_operator || '',
      };
    } catch (e) {
      console.error('Failed to parse geo data:', e);
    }
  }

  return NextResponse.json({
    success: true,
    ip,
    local: ip === "127.0.0.1" || ip === "::1",
    geo,
    asn: geo?.asn || null,
    clientIp: h.get("eo-connecting-ip") || ip,
  });
}