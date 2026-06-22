"use client";

import { useEffect, useState } from "react";
import {
  Globe,
  Cpu,
  Monitor,
  MonitorSmartphone,
  Copy,
  Check,
  RefreshCw,
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

  gpuName: string;
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

  function parseBrowser(ua: string) {
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
        name: "Mozilla Firefox",
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
  }

  function parseOS(ua: string) {
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Mac")) return "macOS";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
    if (ua.includes("Linux")) return "Linux";

    return "Unknown";
  }

  function getGpuInfo() {
    try {
      const canvas = document.createElement("canvas");

      const gl =
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");

      if (!gl) {
        return {
          gpuName: "-",
          gpuVendor: "-",
        };
      }

      const ext = (gl as WebGLRenderingContext).getExtension(
        "WEBGL_debug_renderer_info"
      );

      if (!ext) {
        return {
          gpuName: "-",
          gpuVendor: "-",
        };
      }

      const renderer = String(
        (gl as WebGLRenderingContext).getParameter(
          (ext as any).UNMASKED_RENDERER_WEBGL
        )
      );

      const vendor = String(
        (gl as WebGLRenderingContext).getParameter(
          (ext as any).UNMASKED_VENDOR_WEBGL
        )
      );

      let gpuName = renderer;

      const angleMatch = renderer.match(/ANGLE \((.*?) Direct3D/i);

      if (angleMatch) {
        gpuName = angleMatch[1];
      }

      gpuName = gpuName
        .replace("Google", "")
        .replace(/\s+/g, " ")
        .trim();

      let gpuVendor = vendor;

      if (vendor.includes("NVIDIA")) gpuVendor = "NVIDIA";
      else if (vendor.includes("Intel")) gpuVendor = "Intel";
      else if (vendor.includes("AMD")) gpuVendor = "AMD";

      return {
        gpuName,
        gpuVendor,
      };
    } catch {
      return {
        gpuName: "-",
        gpuVendor: "-",
      };
    }
  }

  async function loadInfo() {
    setLoading(true);

    try {
      let ip = "127.0.0.1";

      try {
        const res = await fetch("/api/my-ip", {
          cache: "no-store",
        });

        if (res.ok) {
          const json = await res.json();

          ip = json.ip || ip;
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

        gpuName: gpu.gpuName,
        gpuVendor: gpu.gpuVendor,

        resolution: `${screen.width} × ${screen.height}`,

        availableResolution: `${screen.availWidth} × ${screen.availHeight}`,

        colorDepth: screen.colorDepth,

        pixelRatio: window.devicePixelRatio,

        orientation:
          screen.orientation?.type || "Unknown",

        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInfo();
  }, []);

  function copyAll() {
    if (!info) return;

    navigator.clipboard.writeText(`
公网IP：${info.ip}

浏览器：${info.browser}
版本：${info.browserVersion}
语言：${info.language}
备用语言：${info.languages.join(",")}

操作系统：${info.os}
平台：${info.platform}
CPU线程：${info.cpu}
设备内存：${info.memory} GB

GPU型号：${info.gpuName}
GPU厂商：${info.gpuVendor}

分辨率：${info.resolution}
可用区域：${info.availableResolution}
颜色深度：${info.colorDepth}
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
            {loading ? "检测中..." : info?.ip}
          </div>

          {copied && (
            <div className="absolute inset-0 bg-green-50 flex items-center justify-center text-green-600 font-medium rounded-2xl">
              <Check className="w-5 h-5 mr-2" />
              已复制全部信息
            </div>
          )}
        </div>
      </div>

      {/* 浏览器 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <h3 className="flex items-center font-semibold text-slate-700 mb-4">
          <Globe className="w-5 h-5 mr-2 text-indigo-600" />
          💻 浏览器
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

      {/* 系统 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <h3 className="flex items-center font-semibold text-slate-700 mb-4">
          <Cpu className="w-5 h-5 mr-2 text-indigo-600" />
          🖥 系统
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
          🎮 GPU
        </h3>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-start">
            <span className="text-slate-500">型号</span>

            <span className="text-right max-w-[70%] break-all">
              {info?.gpuName}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">厂商</span>
            <span>{info?.gpuVendor}</span>
          </div>
        </div>
      </div>

      {/* 屏幕 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <h3 className="flex items-center font-semibold text-slate-700 mb-4">
          <Monitor className="w-5 h-5 mr-2 text-indigo-600" />
          📺 屏幕
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
        <h3 className="font-semibold text-slate-700 mb-4">
          📄 UserAgent
        </h3>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <pre className="whitespace-pre-wrap break-all text-xs leading-6 text-slate-600 font-mono">
            {info?.userAgent}
          </pre>
        </div>
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