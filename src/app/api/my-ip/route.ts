import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const h = await headers();

  const ip =
    h.get("eo-connecting-ip") ||
    h.get("edge-inner-client-ip") ||
    h.get("cf-connecting-ip") ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "127.0.0.1";

  return NextResponse.json({
    success: true,
    ip,
    local: ip === "127.0.0.1" || ip === "::1",
  });
}