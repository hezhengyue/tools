"use client";

import { useEffect, useState } from "react";
import {
  MapPin,
  Radio,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import ToolShell from "@/components/ToolShell";
import {
  Panel, KeyRow, Button, DisplayBox, EmptyState, ToolActions,
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

function IpGeoCore() {
  const [data, setData] = useState<IpGeoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/my-ip", { cache: "no-store" });
      if (res.ok) {
        setData(await res.json());
      } else {
        setFetchError(`接口返回 ${res.status}，请稍后重试`);
        setData(null);
      }
    } catch {
      setFetchError("网络请求失败，请检查网络后重试");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function copyAll() {
    if (!data) return;

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

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
            <EmptyState>{loading ? "正在获取..." : "暂无数据"}</EmptyState>
          )}
        </div>
      </Panel>

      {/* 操作按钮 */}
      <ToolActions>
        <Button variant="secondary" icon={Copy} onClick={copyAll} disabled={!data}>
          复制全部
        </Button>
        <Button onClick={loadData} disabled={loading}>
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
