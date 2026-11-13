// app/ip-subnet/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Binary, Globe2, Network, Search, ShieldCheck } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import {
  Button, CopyButton, KeyRow, Notice, OutputBlock, Panel,
} from "@/components/ui/ToolUI";
import {
  calcSubnet, containsIp, intToIpv4, prefixFromMask, SAMPLES,
  splitSubnets, toBinary, type SubnetInfo,
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

function BinaryRows({ info }: { info: SubnetInfo }) {
  const rows: [string, number][] = [
    ["IP 地址", info.ipInt],
    ["子网掩码", info.maskInt],
    ["网络地址", info.networkInt],
    ["广播地址", info.broadcastInt],
  ];
  return (
    <div className="ui-kv-list">
      {rows.map(([label, value]) => (
        <div key={label} className="ui-kv">
          <span className="ui-kv-label">{label}</span>
          <span className="ui-kv-value font-mono text-xs break-all">{toBinary(value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function IpSubnetPage() {
  const [address, setAddress] = useState("192.168.1.130");
  const [prefix, setPrefix] = useState(24);
  const [intText, setIntText] = useState("3232235818");
  const [maskText, setMaskText] = useState("255.255.255.0");
  const [checkIp, setCheckIp] = useState("192.168.1.200");
  const [targetPrefix, setTargetPrefix] = useState(26);

  const result = useMemo(() => {
    try {
      return { info: calcSubnet(address, prefix), error: "" };
    } catch (cause) {
      return { info: null, error: cause instanceof Error ? cause.message : "地址不合法" };
    }
  }, [address, prefix]);

  const intResult = useMemo(() => {
    const raw = intText.trim();
    if (!/^\d+$/.test(raw)) return { text: "", error: "请输入 0 ~ 4294967295 的十进制整数" };
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
      return { text: "", error: "整数超出 IPv4 范围（0 ~ 4294967295）" };
    }
    return { text: intToIpv4(value), error: "" };
  }, [intText]);

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

  const effectiveTarget = Math.min(32, Math.max(result.info ? result.info.prefix + 1 : 25, targetPrefix));
  const split = useMemo(
    () => result.info ? splitSubnets(result.info, effectiveTarget, 32) : { list: [], total: 0 },
    [result.info, effectiveTarget],
  );

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
                setTargetPrefix(Math.min(32, Number(cidr) + 2));
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

          <Panel icon={Binary} title="二进制视图" className="mt-5">
            <BinaryRows info={result.info} />
            <Notice tone="info" className="mt-4">
              掩码中连续的 1 是网络位，后面的 0 是主机位；主机位全 0 为网络地址，全 1 为广播地址。/31 按 RFC 3021 用于点对点链路，两个地址均可使用。
            </Notice>
          </Panel>

          <Panel icon={ShieldCheck} title="IPv4 与整数互转" className="mt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ip-to-int" className="ui-label text-sm block mb-2">当前 IP → 十进制整数</label>
                <div className="flex items-center gap-2">
                  <input readOnly value={String(result.info.ipInt)} className="ui-input font-mono bg-slate-50" aria-label="IP 对应的整数" />
                  <CopyButton value={String(result.info.ipInt)} label="复制整数值" />
                </div>
              </div>
              <div>
                <label htmlFor="int-to-ip" className="ui-label text-sm block mb-2">十进制整数 → IP</label>
                <div className="flex items-center gap-2">
                  <input
                    id="int-to-ip"
                    value={intText}
                    onChange={(event) => setIntText(event.target.value)}
                    inputMode="numeric"
                    className="ui-input font-mono"
                  />
                  <CopyButton value={intResult.text} label="复制 IP" />
                </div>
              </div>
            </div>
            {intResult.error
              ? <Notice tone="error" className="mt-3">{intResult.error}</Notice>
              : <div className="mt-3 text-sm text-slate-700">转换结果：<code className="font-mono text-indigo-700">{intResult.text}</code></div>}
          </Panel>

          <Panel icon={Search} title="掩码反推与包含判断" className="mt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <Button variant="secondary" size="sm" disabled={maskResult.prefix < 0} onClick={() => setPrefix(maskResult.prefix)}>应用</Button>
                </div>
                {maskResult.error
                  ? <p className="text-xs text-red-600 mt-2">{maskResult.error}</p>
                  : <p className="text-sm text-slate-700 mt-2">对应 <code className="font-mono text-indigo-700">/{maskResult.prefix}</code></p>}
              </div>
              <div>
                <label htmlFor="check-ip" className="ui-label text-sm block mb-2">判断 IP 是否属于当前网段</label>
                <input
                  id="check-ip"
                  value={checkIp}
                  onChange={(event) => setCheckIp(event.target.value)}
                  spellCheck={false}
                  className="ui-input font-mono"
                />
                {checkResult.error
                  ? <p className="text-xs text-red-600 mt-2">{checkResult.error}</p>
                  : <Notice tone={checkResult.text === "在该网段内" ? "success" : "info"} className="mt-2">{checkResult.text}</Notice>}
              </div>
            </div>
          </Panel>

          <Panel icon={Network} title="子网划分" className="mt-5">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <label htmlFor="target-prefix" className="text-sm text-slate-600">划分为</label>
              <select
                id="target-prefix"
                value={effectiveTarget}
                onChange={(event) => setTargetPrefix(Number(event.target.value))}
                className="ui-select ui-input-sm w-28"
              >
                {Array.from({ length: 32 - result.info.prefix }, (_, index) => result.info!.prefix + index + 1).map((value) => (
                  <option key={value} value={value}>/{value}</option>
                ))}
              </select>
              <span className="text-sm text-slate-500">共 {split.total.toLocaleString()} 个子网，下面显示前 {split.list.length} 个</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[560px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    {["子网", "网络地址", "可用范围", "广播地址"].map((head) => (
                      <th key={head} className="text-left font-semibold px-3 py-2 border border-slate-200">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {split.list.map((item) => (
                    <tr key={item.cidr} className="text-slate-700">
                      <td className="px-3 py-2 border border-slate-200 font-mono text-indigo-700 whitespace-nowrap">{item.cidr}</td>
                      <td className="px-3 py-2 border border-slate-200 font-mono whitespace-nowrap">{item.network}</td>
                      <td className="px-3 py-2 border border-slate-200 font-mono whitespace-nowrap">{item.firstHost} ~ {item.lastHost}</td>
                      <td className="px-3 py-2 border border-slate-200 font-mono whitespace-nowrap">{item.broadcast}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="mt-5">
            <OutputBlock
              label="计算摘要"
              value={summary}
              filename="subnet.txt"
              minHeight="min-h-[130px]"
              textareaClassName="text-xs"
            />
          </div>
        </>
      )}

      <Notice tone="tip" className="mt-5">
        仅支持 IPv4。所有计算在本机完成，不会向任何服务查询你的 IP；这里输入的地址只是计算样本，与你的真实公网 IP 无关。
      </Notice>
    </ToolShell>
  );
}
