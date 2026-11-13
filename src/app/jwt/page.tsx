// app/jwt/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Braces, Clock3, KeyRound, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Badge, Button, KeyRow, Notice, OutputBlock } from "@/components/ui/ToolUI";

interface JwtResult {
  ok: true;
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  headerJson: string;
  payloadJson: string;
}

type Parsed = JwtResult | { ok: false; error: string };

function decodeBase64Url(part: string, label: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(part)) {
    throw new Error(`${label} 含非法字符，标准 JWT 应使用 Base64URL（只含 A-Z a-z 0-9 - _）`);
  }
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new Error(`${label} 无法按 Base64 解码`);
  }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} 不是有效的 UTF-8 文本`);
  }
}

function parseJson(raw: string, label: string): Record<string, unknown> {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} 必须是一个 JSON 对象`);
  }
  return value as Record<string, unknown>;
}

function parseJwt(token: string): Parsed {
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    return { ok: false, error: `JWT 应由「头.载荷.签名」三段组成，当前检测到 ${parts.length} 段` };
  }
  try {
    const headerRaw = decodeBase64Url(parts[0], "Header");
    const payloadRaw = decodeBase64Url(parts[1], "Payload");
    const header = parseJson(headerRaw, "Header");
    const payload = parseJson(payloadRaw, "Payload");
    return {
      ok: true,
      header,
      payload,
      signature: parts[2],
      headerJson: JSON.stringify(header, null, 2),
      payloadJson: JSON.stringify(payload, null, 2),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function toSeconds(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatDateTime(seconds: number | null) {
  if (seconds === null) return "—";
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return "无效时间戳";
  return `${date.toLocaleString("zh-CN", { hour12: false })}（${date.toISOString()}）`;
}

function formatDuration(ms: number) {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (days) return `${days} 天 ${hours} 小时 ${minutes} 分`;
  if (hours) return `${hours} 小时 ${minutes} 分 ${secs} 秒`;
  if (minutes) return `${minutes} 分 ${secs} 秒`;
  return `${secs} 秒`;
}

function stringify(value: unknown) {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function encodeSamplePart(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default function JwtPage() {
  const [token, setToken] = useState("");
  const [now, setNow] = useState(0);

  useEffect(() => {
    queueMicrotask(() => setNow(Date.now()));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const parsed = useMemo<Parsed | null>(() => (token.trim() ? parseJwt(token) : null), [token]);
  const result = parsed?.ok ? parsed : null;
  const error = parsed && !parsed.ok ? parsed.error : "";

  const exp = result ? toSeconds(result.payload.exp) : null;
  const iat = result ? toSeconds(result.payload.iat) : null;
  const nbf = result ? toSeconds(result.payload.nbf) : null;
  const alg = result ? stringify(result.header.alg ?? "（未提供）") : "";
  const expired = exp !== null && now > 0 ? now >= exp * 1000 : null;
  const remaining = exp !== null && now > 0 ? Math.abs(exp * 1000 - now) : 0;
  const notYetValid = nbf !== null && now > 0 ? now < nbf * 1000 : null;

  const loadSample = () => {
    const nowSec = Math.floor(Date.now() / 1000);
    setToken(
      `${encodeSamplePart({ alg: "HS256", typ: "JWT", kid: "demo-key" })}.` +
      `${encodeSamplePart({ sub: "1234567890", name: "示例用户", role: "admin", iss: "tools.local", iat: nowSec, nbf: nowSec - 60, exp: nowSec + 3600 })}.` +
      `SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`
    );
  };

  const claimRows: { label: string; value: string; mono?: boolean }[] = result
    ? [
        { label: "exp 过期时间", value: `${formatDateTime(exp)}${expired === null ? "" : expired ? " · 已过期" : ` · 剩余 ${formatDuration(remaining)}`}` },
        { label: "iat 签发时间", value: formatDateTime(iat) },
        { label: "nbf 生效时间", value: `${formatDateTime(nbf)}${notYetValid ? " · 尚未生效" : ""}` },
        ...["iss", "sub", "aud", "jti", "scope", "name", "role"]
          .filter((key) => result.payload[key] !== undefined)
          .map((key) => ({ label: key, value: stringify(result.payload[key]), mono: true })),
      ]
    : [];

  return (
    <ToolShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="jwt-token" className="ui-label text-sm">JWT 字符串</label>
            <span className="text-xs text-slate-500">{token.length} 字符</span>
          </div>
          <textarea
            id="jwt-token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            spellCheck={false}
            placeholder="粘贴 eyJhbGciOi... 开头的 JWT"
            className="ui-textarea min-h-[130px] break-all"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={Sparkles} onClick={loadSample}>载入示例</Button>
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setToken("")} disabled={!token}>清空</Button>
          </div>
        </div>

        {error && <Notice tone="error">解析失败：{error}</Notice>}

        {!token.trim() && (
          <Notice tone="tip">
            粘贴一个 JWT 即可查看 Header、Payload 与过期状态；也可以先点「载入示例」看看效果。
          </Notice>
        )}

        {result && (
          <>
            {/* 概览 */}
            <div className="flex flex-wrap items-center gap-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <Badge className="bg-indigo-50 text-indigo-700"><KeyRound size={13} className="inline mr-1" />alg: {alg}</Badge>
              <Badge className="bg-slate-100 text-slate-700">typ: {stringify(result.header.typ ?? "（未提供）")}</Badge>
              {expired !== null && (
                <Badge className={expired ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}>
                  <Clock3 size={13} className="inline mr-1" />
                  {expired ? "已过期" : `有效期剩 ${formatDuration(remaining)}`}
                </Badge>
              )}
              {notYetValid && <Badge className="bg-amber-50 text-amber-700">尚未到 nbf 生效时间</Badge>}
              {exp === null && <Badge className="bg-slate-100 text-slate-600">未声明 exp，永不过期</Badge>}
            </div>

            {alg.toLowerCase() === "none" && (
              <Notice tone="error">
                <ShieldAlert size={15} className="inline mr-1" />
                该 token 声明 <code className="font-mono">alg: none</code>，即完全没有签名，任何人都能伪造内容，切勿信任。
              </Notice>
            )}

            {/* 时间轴与声明 */}
            <div className="space-y-3">
              <span className="ui-label text-sm flex items-center gap-2"><Clock3 size={16} className="text-indigo-600" /> 时间声明</span>
              <div className="ui-kv-list">
                {claimRows.map((row) => (
                  <KeyRow key={row.label} label={row.label} value={row.value} mono={row.mono} />
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-slate-200">
              <span className="ui-label text-sm flex items-center gap-2"><Braces size={16} className="text-indigo-600" /> 解码内容</span>
              <OutputBlock
                label="Header"
                hint="头部：算法与类型"
                value={result.headerJson}
                copyLabel="复制 Header"
                filename="jwt-header.json"
                mimeType="application/json;charset=utf-8"
                minHeight="min-h-[120px]"
                textareaClassName="text-xs"
              />
              <OutputBlock
                label="Payload"
                hint="载荷：声明与业务数据"
                value={result.payloadJson}
                copyLabel="复制 Payload"
                filename="jwt-payload.json"
                mimeType="application/json;charset=utf-8"
                minHeight="min-h-[200px]"
                textareaClassName="text-xs"
              />
              <OutputBlock
                label="Signature"
                hint="签名段（Base64URL，本站不验签）"
                value={result.signature}
                copyLabel="复制签名"
                minHeight="min-h-[80px]"
                textareaClassName="text-xs"
              />
            </div>

            <Notice tone="error">
              <ShieldAlert size={15} className="inline mr-1" />
              本站只做 Base64URL 解码，<strong>不验证签名、不校验密钥</strong>，展示的内容可能被篡改。生产环境的真实 token 等于登录凭证，请勿粘贴到任何在线工具。
            </Notice>
          </>
        )}
      </div>
    </ToolShell>
  );
}
