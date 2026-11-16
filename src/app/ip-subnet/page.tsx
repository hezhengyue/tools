// app/ip-subnet/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Globe2, Network } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Button, KeyRow, Notice, Section } from "@/components/ui/ToolUI";
import { calcSubnet, intToIpv4, SAMPLES, type SubnetInfo } from "./ip-utils";

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
function RefList({ items }: { items: { key: string; note: string }[] }) {
  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <div key={item.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <code className="font-mono text-sm text-slate-800 w-44 shrink-0">{item.key}</code>
          <span className="text-xs text-slate-500">{item.note}</span>
        </div>
      ))}
    </div>
  );
}

/* 数据来源：IANA IPv4 Special-Purpose Address Registry（25 条）+ RFC 1918 / 6598。
   每条都带 RFC，便于核对；地址数按 2^(32-前缀) 计算。 */
const PRIVATE_RANGES = [
  { key: "10.0.0.0/8", note: "私有 A 类 · 16,777,216 个 · RFC 1918 · 企业内网" },
  { key: "172.16.0.0/12", note: "私有 B 类 · 1,048,576 个 · RFC 1918 · 172.16~172.31" },
  { key: "192.168.0.0/16", note: "私有 C 类 · 65,536 个 · RFC 1918 · 家用路由器默认" },
  { key: "127.0.0.0/8", note: "环回 · 16,777,216 个 · RFC 1122 · 指向本机" },
  { key: "169.254.0.0/16", note: "链路本地 APIPA · 65,536 个 · RFC 3927 · DHCP 失败时自配" },
  { key: "100.64.0.0/10", note: "运营商级 NAT（CGNAT）· 4,194,304 个 · RFC 6598" },
];

const RESERVED_RANGES = [
  { key: "0.0.0.0/8", note: "本网络 · 16,777,216 个 · RFC 791 · 仅作源地址占位" },
  { key: "0.0.0.0/32", note: "本主机 · RFC 1122 · 未配置地址时的源地址" },
  { key: "192.0.0.0/24", note: "IETF 协议分配 · 256 个 · RFC 6890 · 内部再细分见下" },
  { key: "192.0.0.0/29", note: "服务连续性前缀 · 8 个 · RFC 7335" },
  { key: "192.0.0.8/32", note: "IPv4 哑地址 · RFC 7600 · 不可作为目的地址" },
  { key: "192.0.0.9/32", note: "PCP 任播 · RFC 7723 · 例外：可全球路由" },
  { key: "192.0.0.10/32", note: "TURN 任播 · RFC 8155 · 例外：可全球路由" },
  { key: "192.0.0.170/32", note: "NAT64 / DNS64 发现 · RFC 8880（171 同理）" },
  { key: "192.0.2.0/24", note: "文档示例 TEST-NET-1 · 256 个 · RFC 5737" },
  { key: "192.31.196.0/24", note: "AS112-v4 · 256 个 · RFC 7535 · 可全球路由" },
  { key: "192.52.193.0/24", note: "AMT 自动隧道 · 256 个 · RFC 7450 · 可全球路由" },
  { key: "192.88.99.0/24", note: "6to4 中继任播 · RFC 7526 · 已废弃（2015-03）" },
  { key: "192.175.48.0/24", note: "AS112 直接委派 · 256 个 · RFC 7534 · 可全球路由" },
  { key: "198.18.0.0/15", note: "网络设备基准测试 · 131,072 个 · RFC 2544" },
  { key: "198.51.100.0/24", note: "文档示例 TEST-NET-2 · 256 个 · RFC 5737" },
  { key: "203.0.113.0/24", note: "文档示例 TEST-NET-3 · 256 个 · RFC 5737" },
  { key: "224.0.0.0/4", note: "组播 D 类 · 268,435,456 个 · RFC 5771 · 不分配给单播主机" },
  { key: "240.0.0.0/4", note: "保留 E 类 · 268,435,456 个 · RFC 1112 · 含 255.255.255.255" },
  { key: "255.255.255.255/32", note: "受限广播 · 1 个 · RFC 919 · 只在本地链路广播" },
];

const FIRST_OCTET = [
  { key: "1 ~ 9、11 ~ 126", note: "A 类公网单播（10 段为私有，0 段为本网络）" },
  { key: "128 ~ 168、173 ~ 191", note: "B 类公网单播（169.254 链路本地、172.16~172.31 私有）" },
  { key: "192 ~ 223", note: "C 类公网单播（192.0.0/24、192.0.2/24、192.168/16 等除外）" },
  { key: "224 ~ 239", note: "组播，不分配给主机（233.252.0.0/24 为组播测试段）" },
  { key: "240 ~ 255", note: "保留段，除 255.255.255.255 广播外全部不可用" },
];

export default function IpSubnetPage() {
  const [address, setAddress] = useState("192.168.1.130");
  const [prefix, setPrefix] = useState(24);

  const result = useMemo(() => {
    try {
      return { info: calcSubnet(address, prefix), error: "" };
    } catch (cause) {
      return { info: null, error: cause instanceof Error ? cause.message : "地址不合法" };
    }
  }, [address, prefix]);

  const handleAddress = (value: string) => {
    const [ip, cidr, ...rest] = value.split("/");
    setAddress(ip);
    if (cidr !== undefined && !rest.length && /^\d{1,2}$/.test(cidr)) {
      const next = Number(cidr);
      if (next >= 0 && next <= 32) setPrefix(next);
    }
  };

  return (
    <ToolShell>
      <Section icon={Globe2} title="IPv4 地址与前缀">
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
      </Section>

      {result.info && (
        <Section icon={Network} title="子网计算结果">
          <ResultRows info={result.info} />
        </Section>
      )}

      <section className="mt-6">
        <h3 className="ui-label text-sm mb-2">内网与本地地址段</h3>
        <RefList items={PRIVATE_RANGES} />
        <p className="ui-note mt-2">
          IPv6 对应段：<code className="font-mono">fc00::/7</code> 唯一本地、<code className="font-mono">fe80::/10</code> 链路本地、<code className="font-mono">::1</code> 环回。
        </p>
      </section>

      <section className="mt-5">
        <h3 className="ui-label text-sm mb-2">保留与不可路由段</h3>
        <p className="ui-note mb-2">
          覆盖 IANA IPv4 Special-Purpose Address Registry 的全部条目（含 192.0.0.0/24 里再细分的 /29 与 /32），另加组播段 224.0.0.0/4。
        </p>
        <RefList items={RESERVED_RANGES} />
      </section>

      <section className="mt-5">
        <h3 className="ui-label text-sm mb-2">公网可路由地址</h3>
        <p className="ui-note mb-2">
          IPv4 共 4,294,967,296 个，保留 / 私有 / 组播段占 592,709,632 个，其余 <strong className="font-semibold text-slate-700">3,702,257,664 个（86.2%）</strong> 都是可公网路由的单播地址。
        </p>
        <RefList items={FIRST_OCTET} />
      </section>

      <p className="ui-note mt-5">
        仅支持 IPv4，地址段取自 IANA 注册表与 RFC 1918 / 6598（逐条标了 RFC），全部计算在本机完成。
      </p>
    </ToolShell>
  );
}
