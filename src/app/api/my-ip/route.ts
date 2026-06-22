import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const h = await headers();

  const forwarded = h.get("x-forwarded-for");

  const ip =
    forwarded?.split(",")[0].trim() ||
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-client-ip") ||
    "127.0.0.1";

  return NextResponse.json({
    success: true,
    ip,
    local:
      ip === "127.0.0.1" ||
      ip === "::1",
    headers: {
      forwarded: h.get("x-forwarded-for"),
      realIp: h.get("x-real-ip"),
      cfIp: h.get("cf-connecting-ip"),
    },
  });
}