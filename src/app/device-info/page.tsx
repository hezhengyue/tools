"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  Check,
  RefreshCw,
  Globe,
  Monitor,
  Cpu,
  MonitorSmartphone,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import ToolShell from "@/components/ToolShell";

interface DeviceInfo {
  ip: string;

  browser: string;
  browserVersion: string;
  language: string;
  languages: string[];
  userAgent: string;

  os: string;
  platform: string;
  cpu: number | string;
  memory: number | string;

  gpuRenderer: string;
  gpuVendor: string;

  resolution: string;
  availableResolution: string;
  colorDepth: number;
  pixelRatio: number;
  orientation: string;

  timezone: string;
}

function DeviceInfoCore() {
  const [info, setInfo] = useState<DeviceInfo | null>(null);

  const [loading, setLoading] = useState(false);

  const [copied, setCopied] = useState(false);

  const [showUA, setShowUA] = useState(false);

  const parseBrowser = (ua: string) => {
    if (ua.includes("Edg/")) {
      return {
        name: "Microsoft Edge",
        version: ua.match(/Edg\/([\d.]+)/)?.[1] || "-",
      };
    }

    if (ua.includes("Chrome/")) {
      return {
        name: "Google Chrome",
        version: ua.match(/Chrome\/([\d.]+)/)?.[1] || "-",
      };
    }

    if (ua.includes("Firefox/")) {
      return {
        name: "Firefox",
        version: ua.match(/Firefox\/([\d.]+)/)?.[1] || "-",
      };
    }

    if (ua.includes("Safari/") && !ua.includes("Chrome")) {
      return {
        name: "Safari",
        version: ua.match(/Version\/([\d.]+)/)?.[1] || "-",
      };
    }

    return {
      name: navigator.appName,
      version: "-",
    };
  };

  const parseOS = (ua: string) => {
    if (ua.includes("Windows NT 10.0")) return "Windows 10 / 11";
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Mac OS")) return "macOS";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("iPhone")) return "iOS";
    if (ua.includes("Linux")) return "Linux";
    return "Unknown";
  };

  const getGpuInfo = () => {
    try {
      const canvas = document.createElement("canvas");

      const gl =
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");

      if (!gl) {
        return {
          renderer: "-",
          vendor: "-",
        };
      }

      const ext = (gl as WebGLRenderingContext).getExtension(
        "WEBGL_debug_renderer_info"
      );

      if (!ext) {
        return {
          renderer: "-",
          vendor: "-",
        };
      }

      return {
        renderer: (gl as WebGLRenderingContext).getParameter(
          (ext as any).UNMASKED_RENDERER_WEBGL
        ),
        vendor: (gl as WebGLRenderingContext).getParameter(
          (ext as any).UNMASKED_VENDOR_WEBGL
        ),
      };
    } catch {
      return {
        renderer: "-",
        vendor: "-",
      };
    }
  };

  const loadInfo = async () => {
    setLoading(true);

    try {
      let ip = "127.0.0.1";

      try {
        const res = await fetch("/api/my-ip", {
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();

          ip = data.ip || ip;
        }
      } catch {}

      const ua = navigator.userAgent;

      const browser = parseBrowser(ua);

      const gpu = getGpuInfo();

      setInfo({
        ip,

        browser: browser.name,
        browserVersion: browser.version,

        language: navigator.language,

        languages: [...navigator.languages],

        userAgent: ua,

        os: parseOS(ua),

        platform: navigator.platform,

        cpu: navigator.hardwareConcurrency || "-",

        memory: (navigator as any).deviceMemory || "-",

        gpuRenderer: gpu.renderer,

        gpuVendor: gpu.vendor,

        resolution: `${window.screen.width} × ${window.screen.height}`,

        availableResolution: `${window.screen.availWidth} × ${window.screen.availHeight}`,

        colorDepth: window.screen.colorDepth,

        pixelRatio: window.devicePixelRatio,

        orientation:
          window.screen.orientation?.type || "Unknown",

        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInfo();
  }, []);

  const copyIp = () => {
    if (!info) return;

    navigator.clipboard.writeText(info.ip);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  const copyAll = () => {
    if (!info) return;

    navigator.clipboard.writeText(`
公网IP：${info.ip}

浏览器：${info.browser}
版本：${info.browserVersion}
语言：${info.language}
备用语言：${info.languages.join(", ")}

操作系统：${info.os}
平台：${info.platform}
CPU线程：${info.cpu}
设备内存：${info.memory} GB

GPU Renderer：${info.gpuRenderer}
GPU Vendor：${info.gpuVendor}

分辨率：${info.resolution}
可用区域：${info.availableResolution}
颜色深度：${info.colorDepth} bit
像素比：${info.pixelRatio}
屏幕方向：${info.orientation}

时区：${info.timezone}

UserAgent：
${info.userAgent}
`);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <>
          {/* 公网IP */}
      <div className="relative mb-6">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-inner text-center relative overflow-hidden">
          <div className="text-slate-500 text-sm mb-2">
            当前公网 IP
          </div>

          <div className="text-3xl md:text-4xl font-mono font-bold text-slate-800 break-all">
            {loading ? "检测中..." : info?.ip}
          </div>

          {copied && (
            <div className="absolute inset-0 bg-green-50 flex items-center justify-center rounded-2xl text-green-600 font-medium">
              <Check className="w-5 h-5 mr-2" />
              已复制
            </div>
          )}
        </div>

        <button
          onClick={copyIp}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 shadow-sm transition-all"
        >
          <Copy size={18} />
        </button>
      </div>

      {/* 浏览器信息 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <h3 className="flex items-center font-semibold text-slate-700 mb-4">
          <Globe className="w-5 h-5 mr-2 text-indigo-600" />
          浏览器
        </h3>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">浏览器</span>
            <span>{info?.browser}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">版本</span>
            <span>{info?.browserVersion}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">语言</span>
            <span>{info?.language}</span>
          </div>

          <div className="flex justify-between items-start">
            <span className="text-slate-500">备用语言</span>
            <span className="text-right max-w-[70%] break-all">
              {info?.languages.join(", ")}
            </span>
          </div>
        </div>
      </div>

      {/* 系统信息 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <h3 className="flex items-center font-semibold text-slate-700 mb-4">
          <Cpu className="w-5 h-5 mr-2 text-indigo-600" />
          系统
        </h3>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">操作系统</span>
            <span>{info?.os}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">平台</span>
            <span>{info?.platform}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">CPU线程</span>
            <span>{info?.cpu}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">设备内存</span>
            <span>{info?.memory} GB</span>
          </div>
        </div>
      </div>

      {/* GPU */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <h3 className="flex items-center font-semibold text-slate-700 mb-4">
          <MonitorSmartphone className="w-5 h-5 mr-2 text-indigo-600" />
          GPU
        </h3>

        <div className="space-y-3 text-sm">
          <div>
            <div className="text-slate-500 mb-1">Renderer</div>
            <div className="break-all text-slate-700">
              {info?.gpuRenderer}
            </div>
          </div>

          <div>
            <div className="text-slate-500 mb-1">Vendor</div>
            <div className="break-all text-slate-700">
              {info?.gpuVendor}
            </div>
          </div>
        </div>
      </div>

      {/* 屏幕 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <h3 className="flex items-center font-semibold text-slate-700 mb-4">
          <Monitor className="w-5 h-5 mr-2 text-indigo-600" />
          屏幕
        </h3>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">分辨率</span>
            <span>{info?.resolution}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">可用区域</span>
            <span>{info?.availableResolution}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">颜色深度</span>
            <span>{info?.colorDepth} bit</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">像素比</span>
            <span>{info?.pixelRatio}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">屏幕方向</span>
            <span>{info?.orientation}</span>
          </div>
        </div>
      </div>

      {/* 时区 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <h3 className="font-semibold text-slate-700 mb-4">
          🌏 时区
        </h3>

        <div className="flex justify-between text-sm">
          <span className="text-slate-500">TimeZone</span>
          <span>{info?.timezone}</span>
        </div>
      </div>

      {/* UserAgent */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <button
          onClick={() => setShowUA(!showUA)}
          className="w-full flex items-center justify-between font-semibold text-slate-700"
        >
          <span>UserAgent</span>

          {showUA ? (
            <ChevronUp size={18} />
          ) : (
            <ChevronDown size={18} />
          )}
        </button>

        {showUA && (
          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-600 break-all leading-6">
            {info?.userAgent}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={copyAll}
          className="flex items-center justify-center py-3 bg-white border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition-all"
        >
          <Copy size={18} className="mr-2" />
          复制全部
        </button>

        <button
          onClick={loadInfo}
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

export default function DeviceInfoPage() {
  return (
    <ToolShell>
      <DeviceInfoCore />
    </ToolShell>
  );
}