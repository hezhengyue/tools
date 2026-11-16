// app/device-info/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Cpu, Globe, Monitor, MonitorSmartphone, Check, Copy, RefreshCw } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { ActionBar, Button, KeyRow, Section, writeClipboard } from "@/components/ui/ToolUI";
import { collectDeviceInfo, type DeviceInfo } from "./device";

function DeviceInfoCore() {
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const loadInfo = useCallback(async () => {
    setLoading(true);
    try {
      setInfo(await collectDeviceInfo());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  async function copyAll() {
    if (!info) return;

    const text = `浏览器：${info.browser} ${info.browserVersion}
语言：${info.language}
备用语言：${info.languages.join(", ")}

操作系统：${info.os}
系统版本：${info.osVersion}
CPU 架构：${info.arch}
CPU 线程：${info.cpu}
设备内存：${info.memory}

GPU 型号：${info.gpuName}
GPU 厂商：${info.gpuVendor}

逻辑分辨率：${info.screenLogical} CSS px
物理像素：${info.screenPhysical}
可用区域：${info.screenAvailable}
像素比：${info.pixelRatio}
颜色深度：${info.colorDepth}
屏幕方向：${info.orientation}
触控点数：${info.touchPoints}

时区：${info.timezone}（${info.utcOffset}）
当前时间：${info.localTime}

UserAgent：
${info.userAgent}`;

    const ok = await writeClipboard(text);
    if (ok) {
      setCopied(true);
      setCopyError("");
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } else {
      setCopyError("复制失败，请检查浏览器剪贴板权限");
    }
  }

  return (
    <div className="relative">
      {copied && (
        <div className="absolute inset-0 z-50 bg-emerald-50/95 flex items-center justify-center text-emerald-700 font-medium rounded-2xl border border-emerald-200 shadow-lg backdrop-blur-sm">
          <Check className="w-6 h-6 mr-2" />
          已复制全部信息
        </div>
      )}

      <Section icon={Globe} title="浏览器">
        <div className="ui-kv-list">
          <KeyRow label="浏览器" value={info?.browser ?? "检测中…"} />
          <KeyRow label="版本" value={info?.browserVersion ?? "—"} mono />
          <KeyRow label="语言" value={info?.language ?? "—"} />
          <KeyRow label="备用语言" value={info?.languages.join(", ") ?? "—"} />
        </div>
      </Section>

      <Section icon={Cpu} title="系统">
        <div className="ui-kv-list">
          <KeyRow label="操作系统" value={info?.os ?? "检测中…"} />
          <KeyRow label="系统版本" value={info?.osVersion ?? "—"} mono />
          <KeyRow label="CPU 架构" value={info?.arch ?? "—"} />
          <KeyRow label="CPU 线程" value={info?.cpu ?? "—"} />
          <KeyRow label="设备内存" value={info?.memory ?? "—"} />
        </div>
        {info?.memoryApprox && (
          <p className="ui-note mt-3">
            设备内存是浏览器上报的近似值：只取 2 的幂（4 / 8 / 16 GB），部分版本还会截断到 8 GB，因此与系统信息里的容量不一定相同；Safari / Firefox 完全不提供该字段。
          </p>
        )}
      </Section>

      <Section icon={MonitorSmartphone} title="GPU">
        <div className="ui-kv-list">
          <KeyRow label="型号" value={info?.gpuName ?? "读取中…"} />
          <KeyRow label="厂商" value={info?.gpuVendor ?? "—"} />
        </div>
      </Section>

      <Section icon={Monitor} title="屏幕">
        <div className="ui-kv-list">
          <KeyRow label="逻辑分辨率（CSS 像素）" value={info?.screenLogical ?? "—"} mono />
          <KeyRow label="物理像素" value={info?.screenPhysical ?? "—"} mono />
          <KeyRow label="可用区域" value={info?.screenAvailable ?? "—"} mono />
          <KeyRow label="像素比" value={info?.pixelRatio ?? "—"} mono />
          <KeyRow label="颜色深度" value={info?.colorDepth ?? "—"} />
          <KeyRow label="屏幕方向" value={info?.orientation ?? "—"} />
          <KeyRow label="触控点数" value={info ? String(info.touchPoints) : "—"} />
        </div>
        <p className="ui-note mt-3">
          逻辑分辨率受系统缩放影响（125% 缩放下 2560 宽会报 2048）；物理像素 = 逻辑分辨率 × 像素比，才是屏幕真实点数。
        </p>
      </Section>

      <Section title="时区与时间">
        <div className="ui-kv-list">
          <KeyRow label="时区" value={info?.timezone ?? "—"} mono />
          <KeyRow label="UTC 偏移" value={info?.utcOffset ?? "—"} mono />
          <KeyRow label="当前时间" value={info?.localTime ?? "—"} />
        </div>
      </Section>

      <Section title="UserAgent">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <pre className="whitespace-pre-wrap break-all text-xs leading-6 text-slate-600 font-mono">
            {info?.userAgent ?? "读取中…"}
          </pre>
        </div>
      </Section>

      {copyError && (
        <p className="ui-note text-red-600 mt-4" role="alert">{copyError}</p>
      )}

      <ActionBar>
        <Button variant="primary" size="lg" onClick={() => void loadInfo()} disabled={loading} icon={RefreshCw}>
          重新检测
        </Button>
        <Button variant="secondary" size="lg" icon={Copy} onClick={copyAll}>
          复制全部
        </Button>
      </ActionBar>

      <p className="ui-note mt-4">
        所有信息都由本机浏览器 API 读出，不上传；浏览器为了防指纹会主动打折上报（内存只给 2 的幂近似值、系统版本与 GPU 可能被冻结或屏蔽），因此个别项与实际硬件不一致属正常。
      </p>
    </div>
  );
}

export default function DeviceInfoPage() {
  return (
    <ToolShell>
      <DeviceInfoCore />
    </ToolShell>
  );
}
