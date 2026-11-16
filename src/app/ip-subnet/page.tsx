// app/ip-subnet/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Globe2, Network, Search } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import {
  Button, CopyButton, KeyRow, Notice, OutputBlock, Panel,
} from "@/components/ui/ToolUI";
import {
  calcSubnet, containsIp, intToIpv4, prefixFromMask, SAMPLES, type SubnetInfo,
} from "./ip-utils";

function ResultRows({ info }: { info: SubnetInfo }) {
  const rows: [string, string][] = [
    ["网络地址 / CIDR", `${intToIpv4(info.networkInt)}/${info.prefix}`],
    ["子网掩码", `${intToIpv4(info.maskInt)}  (/${info.prefix})`],
    ["反掩码 Wildcard", intToIpv4(info.wildcardInt)],
    ["广播地址", intToIpv4(info.broadcastInt)],
    ["可用主机范围", info.usable > 0
      ? `${intToIpv4(info.firstHost)} ~ ${intToIpv4(info.lastHost)}`
      : "无可分配主机"],
    ["地址总数 / 可用主机数", `${info.total.toLocaleString()} / ${info.usable.toLocaleString()}`],
    ["地址类别", info.class],
    ["地址用途", info.scope],
  ];
  return (
    <div className="ui-kv-list">
      {rows.map(([label, value]) => (
        <KeyRow key={label} label={label} value={value} mono />
      ))}
    </div>
  );
}

/** 纯文字参考列表：只展示，不带复制、不带表格框 */
function RangeList({ items }: { items: { cidr: string; note: string }[] }) {
  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <div key={item.cidr} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <code className="font-mono text-sm text-slate-800 w-40 shrink-0">{item.cidr}</code>
          <span className="text-xs text-slate-500">{item.note}</span>
        </div>
      ))}
    </div>
  );
}

const PRIVATE_RANGES = [
  { cidr: "10.0.0.0/8", note: "私有 A 类 · 16,777,216 个地址 · 企业内网常用" },
  { cidr: "172.16.0.0/12", note: "私有 B 类 · 1,048,576 个地址 · 172.16 ~ 172.31 开头" },
  { cidr: "192.168.0.0/16", note: "私有 C 类 · 65,536 个地址 · 家用路由器默认网段" },
  { cidr: "127.0.0.0/8", note: "环回地址 · 16,777,216 个地址 · 指向本机" },
  { cidr: "169.254.0.0/16", note: "链路本地 · 65,536 个地址 · DHCP 失败时自动配置" },
  { cidr: "100.64.0.0/10", note: "运营商级 NAT（CGNAT）· 4,194,304 个地址" },
];

const PUBLIC_RANGES = [
  { cidr: "0.0.0.0/8", note: "本网络 · 16,777,216 个地址 · 仅作源地址占位" },
  { cidr: "192.0.0.0/24", note: "IETF 协议分配 · 256 个地址" },
  { cidr: "192.0.2.0/24", note: "文档示例 TEST-NET-1 · 256 个地址" },
  { cidr: "198.51.100.0/24", note: "文档示例 TEST-NET-2 · 256 个地址" },
  { cidr: "203.0.113.0/24", note: "文档示例 TEST-NET-3 · 256 个地址" },
  { cidr: "198.18.0.0/15", note: "网络设备基准测试 · 131,072 个地址" },
  { cidr: "224.0.0.0/4", note: "组播 D 类 · 268,435,456 个地址" },
  { cidr: "240.0.0.0/4", note: "保留 E 类 · 268,435,456 个地址" },
  { cidr: "255.255.255.255/32", note: "受限广播 · 单个地址" },
];

export default function IpSubnetPage() {
  const [address, setAddress] = useState("192.168.1.130");
  const [prefix, setPrefix] = useState(24);
  const [maskText, setMaskText] = useState("255.255.255.0");
  const [checkIp, setCheckIp] = useState("192.168.1.200");

  const result = useMemo(() => {
    try {
      return { info: calcSubnet(address, prefix), error: "" };
    } catch (cause) {
      return { info: null, error: cause instanceof Error ? cause.message : "地址不合法" };
    }
  }, [address, prefix]);

  const maskResult = useMemo(() => {
    try {
      return { prefix: prefixFromMask(maskText), error: "" };
    } catch (cause) {
      return { prefix: -1, error: cause instanceof Error ? cause.message : "掩码不合法" };
    }
  }, [maskText]);

  const checkResult = useMemo(() => {
    if (!result.info) return { text: "", error: "" };
    try {
      return { text: containsIp(result.info, checkIp) ? "在该网段内" : "不在该网段内", error: "" };
    } catch (cause) {
      return { text: "", error: cause instanceof Error ? cause.message : "地址不合法" };
    }
  }, [result.info, checkIp]);

  const handleAddress = (value: string) => {
    const [ip, cidr, ...rest] = value.split("/");
    setAddress(ip);
    if (cidr !== undefined && !rest.length && /^\d{1,2}$/.test(cidr)) {
      const next = Number(cidr);
      if (next >= 0 && next <= 32) setPrefix(next);
    }
  };

  const summary = result.info
    ? `地址 ${result.info.ip}/${result.info.prefix}
网络 ${intToIpv4(result.info.networkInt)}
掩码 ${intToIpv4(result.info.maskInt)}
广播 ${intToIpv4(result.info.broadcastInt)}
可用 ${result.info.usable.toLocaleString()} 个主机地址`
    : "";

  return (
    <ToolShell>
      <Panel icon={Globe2} title="IPv4 地址与前缀">
        <label htmlFor="ip-address" className="ui-label text-sm block mb-2">IP 地址（可直接粘贴 CIDR，如 10.0.0.1/8）</label>
        <input
          id="ip-address"
          value={address}
          onChange={(event) => handleAddress(event.target.value)}
          spellCheck={false}
          className="ui-input font-mono text-lg"
          placeholder="192.168.1.130"
        />
        <div className="flex items-center gap-4 mt-4">
          <label htmlFor="ip-prefix" className="text-sm text-slate-600 shrink-0">前缀长度</label>
          <input
            id="ip-prefix"
            type="range"
            min={0}
            max={32}
            value={prefix}
            onChange={(event) => setPrefix(Number(event.target.value))}
            className="w-full accent-indigo-600"
          />
          <span className="font-mono text-indigo-700 font-semibold w-10 text-right shrink-0">/{prefix}</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {SAMPLES.map((sample) => (
            <Button
              key={sample.label}
              variant="secondary"
              size="sm"
              onClick={() => {
                const [ip, cidr] = sample.value.split("/");
                setAddress(ip);
                setPrefix(Number(cidr));
              }}
            >
              {sample.label} {sample.value}
            </Button>
          ))}
        </div>
        {result.error && <Notice tone="error" className="mt-4">{result.error}</Notice>}
      </Panel>

      {result.info && (
        <>
          <Panel icon={Network} title="子网计算结果" className="mt-5">
            <ResultRows info={result.info} />
          </Panel>

          <Panel icon={Search} title="掩码反推与包含判断" className="mt-5">
            <div className="ui-form-grid">
              <div>
                <label htmlFor="mask-input" className="ui-label text-sm block mb-2">点分子网掩码 → 前缀</label>
                <div className="flex items-center gap-2">
                  <input
                    id="mask-input"
                    value={maskText}
                    onChange={(event) => setMaskText(event.target.value)}
                    spellCheck={false}
                    className="ui-input font-mono"
                  />
                  <Button variant="secondary" size="sm" className="shrink-0 whitespace-nowrap" disabled={maskResult.prefix < 0} onClick={() => setPrefix(maskResult.prefix)}>应用</Button>
                </div>
                {maskResult.error
                  ? <p className="text-xs text-red-600 mt-2">{maskResult.error}</p>
                  : <p className="text-sm text-slate-700 mt-2">对应 <code className="font-mono text-indigo-700">/{maskResult.prefix}</code></p>}
              </div>
              <div>
                <label htmlFor="check-ip" className="ui-label text-sm block mb-2">判断 IP 是否属于当前网段</label>
                <div className="flex items-center gap-2">
                  <input
                    id="check-ip"
                    value={checkIp}
                    onChange={(event) => setCheckIp(event.target.value)}
                    spellCheck={false}
                    className="ui-input font-mono"
                  />
                  <CopyButton value={checkResult.text} label="复制判断结果" />
                </div>
                {checkResult.error
                  ? <p className="text-xs text-red-600 mt-2">{checkResult.error}</p>
                  : <Notice tone={checkResult.text === "在该网段内" ? "success" : "info"} className="mt-2">{checkResult.text}</Notice>}
              </div>
            </div>
          </Panel>

          <div className="mt-5">
            <OutputBlock
              label="计算摘要"
              value={summary}
              filename="subnet.txt"
              textareaClassName="text-xs"
            />
          </div>
        </>
      )}

      <section className="mt-6">
        <h3 className="ui-label text-sm mb-2">内网（私有）地址段</h3>
        <RangeList items={PRIVATE_RANGES} />
        <p className="ui-note mt-2">
          IPv6 对应段：<code className="font-mono">fc00::/7</code> 唯一本地、<code className="font-mono">fe80::/10</code> 链路本地、<code className="font-mono">::1</code> 环回。
        </p>
      </section>

      <section className="mt-5">
        <h3 className="ui-label text-sm mb-2">公网地址范围与保留段</h3>
        <p className="ui-note mb-2">
          除下表特殊段和上面的私有段之外，<code className="font-mono">1.0.0.0</code> ~ <code className="font-mono">223.255.255.255</code> 都是可在公网路由的单播地址，不存在「公网专用段」。
        </p>
        <RangeList items={PUBLIC_RANGES} />
      </section>

      <p className="ui-note mt-5">
        仅支持 IPv4。所有计算在本机完成，不会向任何服务查询你的 IP；这里输入的地址只是计算样本，与你的真实公网 IP 无关。
      </p>
    </ToolShell>
  );
}
