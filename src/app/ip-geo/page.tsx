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

interface GeoInfo {
  asn: number | null;
  countryName: string;
  countryCodeAlpha2: string;
  regionName: string;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
  cisp: string;
  timezone: string;
}

interface IpGeoData {
  ip: string;
  local: boolean;
  clientIp?: string;
  asn?: number | null;
  geo: GeoInfo | null;
  source?: string | null;
  error?: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  cdn: "CDN 边缘节点",
  "ipwho.is": "ipwho.is 公共 IP 库",
  "ipapi.co": "ipapi.co 公共 IP 库",
};

function fmt(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "-" : String(value);
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
      text += `时区：${fmt(geo.timezone)}\n`;
      text += `\n【网络信息】\n`;
      text += `ASN：${geo.asn ? `AS${geo.asn}` : "-"}\n`;
      text += `运营商/ISP：${fmt(geo.cisp)}\n`;
    } else {
      text += `\n地理位置信息：暂无\n`;
    }

    if (data.source) {
      text += `\n数据来源：${SOURCE_LABEL[data.source] || data.source}\n`;
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
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center shadow-inner relative overflow-hidden">
          <div className="text-slate-500 text-sm mb-2">
            🌍 当前公网IP
          </div>
          <div className="text-3xl md:text-4xl font-mono font-bold text-slate-800 break-all">
            {loading ? "检测中..." : fmt(data?.ip)}
          </div>
          {data?.local && !loading && (
            <div className="text-xs text-amber-600 mt-2">
              本地开发环境：显示的是当前网络的出网公网 IP
            </div>
          )}
          {copied && (
            <div className="absolute inset-0 bg-green-50 flex items-center justify-center text-green-600 font-medium rounded-2xl">
              <Check className="w-5 h-5 mr-2" />
              已复制全部信息
            </div>
          )}
        </div>
      </div>

      {/* 地理位置卡片 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <h3 className="flex items-center font-semibold text-slate-700 mb-4">
          <MapPin className="w-5 h-5 mr-2 text-indigo-600" />
          📍 地理位置
        </h3>
        <div className="space-y-3 text-sm">
          {geo ? (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">国家/地区</span>
                <span>{geo.countryName} ({geo.countryCodeAlpha2})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">省份/州</span>
                <span>{fmt(geo.regionName)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">城市</span>
                <span>{fmt(geo.cityName)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">经纬度</span>
                <span className="font-mono">{fmt(geo.latitude)}, {fmt(geo.longitude)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">时区</span>
                <span className="font-mono">{fmt(geo.timezone)}</span>
              </div>
            </>
          ) : (
            <div className="text-slate-400 text-center py-4">
              {loading ? "正在获取..." : hint || "暂无数据"}
            </div>
          )}
        </div>
      </div>

      {/* 网络信息卡片 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <h3 className="flex items-center font-semibold text-slate-700 mb-4">
          <Radio className="w-5 h-5 mr-2 text-indigo-600" />
          📡 网络信息
        </h3>
        <div className="space-y-3 text-sm">
          {geo ? (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">ASN</span>
                <span className="font-mono">{geo.asn ? `AS${geo.asn}` : "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">运营商/ISP</span>
                <span>{fmt(geo.cisp)}</span>
              </div>
            </>
          ) : (
            <div className="text-slate-400 text-center py-4">
              {loading ? "正在获取..." : "暂无数据"}
            </div>
          )}
        </div>
      </div>

      {data?.source && (
        <div className="text-xs text-slate-400 text-center -mt-2 mb-4">
          数据来源：{SOURCE_LABEL[data.source] || data.source}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={copyAll}
          disabled={!data}
          className="flex items-center justify-center py-3 bg-white border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Copy size={18} className="mr-2" />
          复制全部
        </button>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center justify-center py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-70"
        >
          <RefreshCw
            size={18}
            className={`mr-2 ${loading ? "animate-spin" : ""}`}
          />
          重新检测
        </button>
      </div>
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
