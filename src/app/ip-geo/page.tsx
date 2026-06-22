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

// 定义 EdgeOne 返回的地理位置数据结构
interface GeoInfo {
  asn: number;
  countryName: string;
  countryCodeAlpha2: string;
  regionName: string;
  cityName: string;
  latitude: number;
  longitude: number;
  cisp: string;
}

interface IpGeoData {
  ip: string;
  local: boolean;
  clientIp?: string;
  asn?: number;
  geo: GeoInfo | null;
}

function IpGeoCore() {
  const [data, setData] = useState<IpGeoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      // 👇 修改这里：将 /api/my-ip 改为 /edge-geo
      const res = await fetch("/api/my-ip", { cache: "no-store" });
      
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        console.error("API Error", res.status);
      }
    } catch (e) {
      console.error("Fetch Error", e);
      setData({ ip: "127.0.0.1", local: true, geo: null });
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
    let text = `公网IP：${data.ip}\n`;
    
    if (geo) {
      text += `\n【地理位置】\n`;
      text += `国家/地区：${geo.countryName} (${geo.countryCodeAlpha2})\n`;
      text += `省份/州：${geo.regionName || "-"}\n`;
      text += `城市：${geo.cityName || "-"}\n`;
      text += `经纬度：${geo.latitude}, ${geo.longitude}\n`;
      
      text += `\n【网络信息】\n`;
      text += `ASN：AS${geo.asn || data.asn || "-"}\n`;
      text += `运营商/ISP：${geo.cisp || "-"}\n`;
    } else {
      text += `\n地理位置信息：暂无 (本地开发或未部署至 EdgeOne)\n`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      {/* 当前公网IP */}
      <div className="relative mb-6">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center shadow-inner relative overflow-hidden">
          <div className="text-slate-500 text-sm mb-2">
            🌍 当前公网IP
          </div>
          <div className="text-3xl md:text-4xl font-mono font-bold text-slate-800 break-all">
            {loading ? "检测中..." : data?.ip}
          </div>
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
          {data?.geo ? (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">国家/地区</span>
                <span>{data.geo.countryName} ({data.geo.countryCodeAlpha2})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">省份/州</span>
                <span>{data.geo.regionName || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">城市</span>
                <span>{data.geo.cityName || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">经纬度</span>
                <span className="font-mono">{data.geo.latitude}, {data.geo.longitude}</span>
              </div>
            </>
          ) : (
            <div className="text-slate-400 text-center py-4">
              {loading ? "正在获取..." : "暂无数据 (请确保已部署至 EdgeOne Pages)"}
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
          {data?.geo ? (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">ASN</span>
                <span className="font-mono">AS{data.geo.asn || data?.asn || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">运营商/ISP</span>
                <span>{data.geo.cisp || "-"}</span>
              </div>
            </>
          ) : (
            <div className="text-slate-400 text-center py-4">
              {loading ? "正在获取..." : "暂无数据"}
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={copyAll}
          disabled={!data?.geo}
          className="flex items-center justify-center py-3 bg-white border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Copy size={18} className="mr-2" />
          复制全部
        </button>
        <button
          onClick={loadData}
          className="flex items-center justify-center py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20"
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