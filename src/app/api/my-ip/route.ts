import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const h = await headers();

  const result: Record<string, string> = {};

  h.forEach((value, key) => {
    result[key] = value;
  });

  return NextResponse.json(result);
}