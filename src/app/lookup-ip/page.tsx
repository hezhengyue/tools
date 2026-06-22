"use client";

import { useEffect, useState } from "react";
import { Copy, Check, RefreshCw } from "lucide-react";
import ToolShell from "@/components/ToolShell";

interface IpInfo {
  ip: string;
  country: string;
  region: string;
  city: string;
  isp: string;

  browser: string;
  language: string;
  platform: string;
  cpu: number;
  memory: string | number;
  screen: string;
  pixelRatio: number;
}

function IpLookupCore() {
  const [info, setInfo] = useState<IpInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadInfo = async () => {
    setLoading(true);

    const deviceInfo = {
      browser: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cpu: navigator.hardwareConcurrency,
      memory: (navigator as any).deviceMemory || "-",
      screen: `${window.screen.width} × ${window.screen.height}`,
      pixelRatio: window.devicePixelRatio,
    };

    const host = window.location.hostname;

    // 本地开发环境
    if (
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "::1"
    ) {
      setInfo({
        ip: host,
        country: "本地开发环境",
        region: "-",
        city: "-",
        isp: "Localhost",
        ...deviceInfo,
      });

      setLoading(false);
      return;
    }

    try {
      const res = await fetch("https://ipwho.is/");

      if (!res.ok) {
        throw new Error("Request failed");
      }

      const data = await res.json();

      setInfo({
        ip: data.ip || host,
        country: data.country || "-",
        region: data.region || "-",
        city: data.city || "-",
        isp: data.connection?.isp || "-",
        ...deviceInfo,
      });
    } catch (error) {
      console.error("IP获取失败", error);

      setInfo({
        ip: host,
        country: "未知",
        region: "-",
        city: "-",
        isp: "-",
        ...deviceInfo,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInfo();
  }, []);

  const copyIp = () => {
    if (!info?.ip) return;

    navigator.clipboard.writeText(info.ip);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <>
      {/* IP展示 */}
      <div className="relative mb-6">
        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center min-h-[100px] flex items-center justify-center shadow-inner relative overflow-hidden">

          <div>
            <div className="text-slate-500 text-sm mb-2">
              当前公网 IP
            </div>

            <div className="text-3xl md:text-4xl font-bold font-mono text-slate-800 break-all">
              {loading ? "加载中..." : info?.ip || "-"}
            </div>
          </div>

          {copied && (
            <div className="absolute inset-0 bg-green-50 text-green-600 flex items-center justify-center rounded-2xl text-lg font-medium">
              <Check className="w-5 h-5 mr-2" />
              已复制
            </div>
          )}
        </div>

        <button
          onClick={copyIp}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 shadow-sm transition-all"
        >
          <Copy size={20} />
        </button>
      </div>

      {/* 网络信息 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
        <h3 className="font-semibold text-slate-700 mb-5 text-lg">
          网络信息
        </h3>

        <div className="space-y-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">国家</span>
            <span className="font-medium">{info?.country || "-"}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">地区</span>
            <span className="font-medium">{info?.region || "-"}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">城市</span>
            <span className="font-medium">{info?.city || "-"}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">ISP</span>
            <span className="font-medium">{info?.isp || "-"}</span>
          </div>
        </div>
      </div>

      {/* 设备信息 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
        <h3 className="font-semibold text-slate-700 mb-5 text-lg">
          设备信息
        </h3>

        <div className="space-y-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">系统</span>
            <span className="font-medium">{info?.platform || "-"}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">语言</span>
            <span className="font-medium">{info?.language || "-"}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">CPU线程</span>
            <span className="font-medium">{info?.cpu || "-"}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">设备内存</span>
            <span className="font-medium">
              {info?.memory ? `${info.memory} GB` : "-"}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">屏幕分辨率</span>
            <span className="font-medium">{info?.screen || "-"}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">像素比</span>
            <span className="font-medium">{info?.pixelRatio || "-"}</span>
          </div>
        </div>
      </div>

      {/* 刷新按钮 */}
      <button
        onClick={loadInfo}
        disabled={loading}
        className="w-full flex items-center justify-center py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 hover:-translate-y-0.5 transition-all shadow-md shadow-indigo-600/20 active:translate-y-0 disabled:opacity-60"
      >
        <RefreshCw
          size={18}
          className={`mr-2 ${loading ? "animate-spin" : ""}`}
        />
        {loading ? "加载中..." : "刷新信息"}
      </button>
    </>
  );
}

export default function IpPage() {
  return (
    <ToolShell>
      <IpLookupCore />
    </ToolShell>
  );
}