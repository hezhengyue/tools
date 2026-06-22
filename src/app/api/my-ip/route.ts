// src/app/api/my-ip/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// 强制在 Edge Runtime 运行，以获取 EdgeOne 注入的 request.eo
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

  // 2. 获取 EdgeOne 注入的上下文 (包含地理位置)
  const eo = (request as any).eo;
  const geo = eo?.geo || null;

  return NextResponse.json({
    success: true,
    ip,
    local: ip === "127.0.0.1" || ip === "::1",
    geo, // 新增：详细的地理位置信息 (国家、城市、经纬度等)
    asn: eo?.asn || null, // 新增：ASN 自治系统编号
    clientIp: eo?.clientIp || ip, // 新增：边缘节点识别的真实客户端 IP
  });
}