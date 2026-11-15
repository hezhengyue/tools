"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapPin,
  Radio,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import ToolShell from "@/components/ToolShell";
import {
  Panel, KeyRow, Button, DisplayBox, EmptyState, ToolActions, writeClipboard,
} from "@/components/ui/ToolUI";

interface GeoInfo {
  asn: number | null;
  countryName: string;
  countryCodeAlpha2: string;
  regionName: string;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
  cisp: string;
}

interface IpGeoData {
  ip: string;
  local: boolean;
  clientIp?: string;
  asn?: number | null;
  geo: GeoInfo | null;
  error?: string | null;
}

function fmt(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const text = String(value).trim();
  // 平台头 / IP 库偶尔会回传占位字符串，统一按空值处理
  if (text === "" || /^(unknown|null|n\/a|none)$/i.test(text)) return "-";
  return text;
}

/**
 * 上游失败时接口会返回 HTTP 200 + { success:false, error }，
 * 也可能返回非对象/缺字段的内容。这里统一规范化，避免把失败响应当成正常结果展示。
 */
function normalize(payload: unknown): IpGeoData | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as Record<string, unknown>;
  if (raw.success === false || typeof raw.ip !== "string" || !raw.ip) return null;

  let geo: GeoInfo | null = null;
  if (raw.geo && typeof raw.geo === "object") {
    const g = raw.geo as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    geo = {
      asn: num(g.asn),
      countryName: str(g.countryName),
      countryCodeAlpha2: str(g.countryCodeAlpha2),
      regionName: str(g.regionName),
      cityName: str(g.cityName),
      latitude: num(g.latitude),
      longitude: num(g.longitude),
      cisp: str(g.cisp),
    };
  }
  return {
    ip: raw.ip,
    local: raw.local === true,
    clientIp: typeof raw.clientIp === "string" ? raw.clientIp : undefined,
    asn: typeof raw.asn === "number" ? raw.asn : null,
    geo,
    error: typeof raw.error === "string" ? raw.error : null,
  };
}

function IpGeoCore() {
  const [data, setData] = useState<IpGeoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const loadData = useCallback(async () => {
    // 后发起的请求作废旧请求，避免 Strict Mode 双调用或连点时旧响应覆盖新结果
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => controller.abort("timeout"), 10_000);
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/my-ip", { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(`接口返回 ${res.status}，请稍后重试`);
      let payload: unknown;
      try {
        payload = await res.json();
      } catch {
        throw new Error("接口返回内容不是有效 JSON，请稍后重试");
      }
      const parsed = normalize(payload);
      if (!parsed) {
        const raw = payload as Record<string, unknown> | null;
        throw new Error(
          raw && typeof raw.error === "string" && raw.error
            ? raw.error
            : "接口数据格式异常，请稍后重试"
        );
      }
      if (requestId !== requestIdRef.current) return;
      setData(parsed);
    } catch (cause) {
      if (requestId !== requestIdRef.current) return;
      const timedOut = controller.signal.reason === "timeout";
      setFetchError(
        timedOut
          ? "请求超时，请检查网络后重试"
          : cause instanceof Error ? cause.message : "网络请求失败，请检查网络后重试"
      );
      setData(null);
    } finally {
      clearTimeout(timer);
      if (requestId === requestIdRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void loadData();
    return () => {
      requestIdRef.current += 1;
      abortRef.current?.abort();
    };
  }, [loadData]);

  async function copyAll() {
    if (!data?.ip) return;

    const geo = data.geo;
    let text = `公网IP：${fmt(data.ip)}\n`;

    if (geo) {
      text += `\n【地理位置】\n`;
      text += `国家/地区：${geo.countryName} (${geo.countryCodeAlpha2})\n`;
      text += `省份/州：${fmt(geo.regionName)}\n`;
      text += `城市：${fmt(geo.cityName)}\n`;
      text += `经纬度：${fmt(geo.latitude)}, ${fmt(geo.longitude)}\n`;
      text += `\n【网络信息】\n`;
      text += `ASN：${geo.asn ? `AS${geo.asn}` : "-"}\n`;
      text += `运营商/ISP：${fmt(geo.cisp)}\n`;
    } else {
      text += `\n地理位置信息：暂无\n`;
    }

    const ok = await writeClipboard(text);
    if (!ok) {
      setCopyError("复制失败，请检查浏览器剪贴板权限");
      return;
    }
    setCopyError("");
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  }

  const geo = data?.geo;
  const hint = fetchError || data?.error;

  return (
    <>
      {/* 当前公网IP */}
      <div className="relative mb-6">
        <DisplayBox
          className="relative overflow-hidden"
          label="🌍 当前公网IP"
          value={loading ? "检测中..." : fmt(data?.ip)}
        >
          {data?.local && !loading && (
            <div className="text-xs text-amber-600 mt-2">
              本地开发环境：显示的是当前网络的出网公网 IP
            </div>
          )}
          {copied && (
            <div className="ui-success-overlay absolute inset-0 flex items-center justify-center font-medium rounded-2xl">
              <Check className="w-5 h-5 mr-2" />
              已复制全部信息
            </div>
          )}
        </DisplayBox>
      </div>

      {/* 地理位置卡片 */}
      <Panel className="mb-6" icon={MapPin} title="📍 地理位置">
        <div className="ui-kv-list">
          {geo ? (
            <>
              <KeyRow label="国家/地区" value={`${geo.countryName} (${geo.countryCodeAlpha2})`} />
              <KeyRow label="省份/州" value={fmt(geo.regionName)} />
              <KeyRow label="城市" value={fmt(geo.cityName)} />
              <KeyRow label="经纬度" value={`${fmt(geo.latitude)}, ${fmt(geo.longitude)}`} mono />
            </>
          ) : (
            <EmptyState>{loading ? "正在获取..." : hint || "暂无数据"}</EmptyState>
          )}
        </div>
      </Panel>

      {/* 网络信息卡片 */}
      <Panel className="mb-6" icon={Radio} title="📡 网络信息">
        <div className="ui-kv-list">
          {geo ? (
            <>
              <KeyRow label="ASN" value={geo.asn ? `AS${geo.asn}` : "-"} mono />
              <KeyRow label="运营商/ISP" value={fmt(geo.cisp)} />
            </>
          ) : (
            <EmptyState>{loading ? "正在获取..." : hint || "暂无数据"}</EmptyState>
          )}
        </div>
      </Panel>

      {copyError && <p className="mb-3 text-sm text-red-600" role="alert">{copyError}</p>}

      {/* 操作按钮 */}
      <ToolActions>
        <Button variant="secondary" icon={Copy} onClick={copyAll} disabled={!data?.ip}>
          复制全部
        </Button>
        <Button onClick={() => void loadData()} disabled={loading}>
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          重新检测
        </Button>
      </ToolActions>
    </>
  );
}

export default function IpGeoPage() {
  return (
    <ToolShell>
      <IpGeoCore />
    </ToolShell>
  );
}
