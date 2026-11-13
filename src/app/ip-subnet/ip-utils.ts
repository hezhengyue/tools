// app/ip-subnet/ip-utils.ts
// IPv4 地址、CIDR 与子网划分计算。用无符号 32 位整数做中介，位运算后统一 >>> 0。

export interface SubnetInfo {
  ip: string;
  prefix: number;
  ipInt: number;
  maskInt: number;
  wildcardInt: number;
  networkInt: number;
  broadcastInt: number;
  firstHost: number;
  lastHost: number;
  total: number;
  usable: number;
  class: string;
  scope: string;
}

export function parseIpv4(text: string): number {
  const parts = text.trim().split(".");
  if (parts.length !== 4) throw new Error("IPv4 地址必须是由点分隔的 4 段数字");
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) throw new Error(`「${part || "空"}」不是 0~255 的十进制数字`);
    if (part.length > 1 && part.startsWith("0")) throw new Error(`「${part}」有前导零，请写成 ${Number(part)}`);
    const octet = Number(part);
    if (octet > 255) throw new Error(`「${part}」超过 255`);
    value = (value << 8) + octet;
  }
  return value >>> 0;
}

export function intToIpv4(value: number): string {
  const n = value >>> 0;
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function toBinary(value: number): string {
  return (value >>> 0).toString(2).padStart(32, "0").match(/.{8}/g)!.join(".");
}

export function maskFromPrefix(prefix: number): number {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error("前缀长度必须是 0~32 的整数");
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

/** 从点分掩码反推前缀，校验掩码必须由连续的 1 组成 */
export function prefixFromMask(maskText: string): number {
  const mask = parseIpv4(maskText);
  const inverted = (~mask) >>> 0;
  // 合法的掩码取反后是连续的低位 1，即 (inverted + 1) 为 2 的幂
  if (((inverted + 1) & inverted) !== 0) throw new Error("子网掩码必须由连续的高位 1 组成，例如 255.255.255.0");
  return 32 - Math.round(Math.log2(inverted + 1));
}

const SPECIAL_RANGES: { start: number; end: number; name: string }[] = [
  { start: 0x00000000, end: 0x00ffffff, name: "本网络（0.0.0.0/8）" },
  { start: 0x0a000000, end: 0x0affffff, name: "私有地址（10.0.0.0/8，RFC 1918）" },
  { start: 0x64400000, end: 0x647fffff, name: "运营商级 NAT（100.64.0.0/10）" },
  { start: 0x7f000000, end: 0x7fffffff, name: "环回地址（127.0.0.0/8）" },
  { start: 0xa9fe0000, end: 0xa9feffff, name: "链路本地（169.254.0.0/16）" },
  { start: 0xac100000, end: 0xac1fffff, name: "私有地址（172.16.0.0/12，RFC 1918）" },
  { start: 0xc0000000, end: 0xc00000ff, name: "IETF 协议分配（192.0.0.0/24）" },
  { start: 0xc0a80000, end: 0xc0a8ffff, name: "私有地址（192.168.0.0/16，RFC 1918）" },
  { start: 0xc6120000, end: 0xc613ffff, name: "性能测试保留（198.18.0.0/15）" },
  { start: 0xe0000000, end: 0xefffffff, name: "组播地址（224.0.0.0/4，D 类）" },
  { start: 0xf0000000, end: 0xffffffff, name: "保留地址（240.0.0.0/4，E 类）" },
];

export function classify(ip: number): { class: string; scope: string } {
  const first = ip >>> 24;
  const cls = first < 128 ? "A 类" : first < 192 ? "B 类" : first < 224 ? "C 类" : first < 240 ? "D 类（组播）" : "E 类（保留）";
  const hit = SPECIAL_RANGES.find((range) => ip >= range.start && ip <= range.end);
  return { class: cls, scope: hit?.name ?? "公网单播地址" };
}

export function calcSubnet(ipText: string, prefix: number): SubnetInfo {
  const ipInt = parseIpv4(ipText);
  const maskInt = maskFromPrefix(prefix);
  const wildcardInt = (~maskInt) >>> 0;
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | wildcardInt) >>> 0;
  const total = 2 ** (32 - prefix);
  // /31 按 RFC 3021 用于点对点链路，两个地址都可用；/32 是单主机路由
  const usable = prefix >= 31 ? total : Math.max(0, total - 2);
  const firstHost = prefix >= 31 ? networkInt : (networkInt + 1) >>> 0;
  const lastHost = prefix >= 31 ? broadcastInt : (broadcastInt - 1) >>> 0;
  const { class: cls, scope } = classify(ipInt);
  return {
    ip: intToIpv4(ipInt), prefix, ipInt, maskInt, wildcardInt,
    networkInt, broadcastInt, firstHost, lastHost, total, usable,
    class: cls, scope,
  };
}

export interface SubnetSlice {
  cidr: string;
  network: string;
  firstHost: string;
  lastHost: string;
  broadcast: string;
}

export function splitSubnets(info: SubnetInfo, targetPrefix: number, limit = 32): { list: SubnetSlice[]; total: number } {
  if (targetPrefix <= info.prefix || targetPrefix > 32) return { list: [], total: 0 };
  const total = 2 ** (targetPrefix - info.prefix);
  const block = 2 ** (32 - targetPrefix);
  const count = Math.min(total, limit);
  const list: SubnetSlice[] = [];
  for (let index = 0; index < count; index += 1) {
    const network = (info.networkInt + index * block) >>> 0;
    const broadcast = (network + block - 1) >>> 0;
    const usable = targetPrefix >= 31 ? block : Math.max(0, block - 2);
    list.push({
      cidr: `${intToIpv4(network)}/${targetPrefix}`,
      network: intToIpv4(network),
      firstHost: usable ? intToIpv4(targetPrefix >= 31 ? network : network + 1) : "—",
      lastHost: usable ? intToIpv4(targetPrefix >= 31 ? broadcast : broadcast - 1) : "—",
      broadcast: intToIpv4(broadcast),
    });
  }
  return { list, total };
}

export function containsIp(info: SubnetInfo, ipText: string): boolean {
  const ip = parseIpv4(ipText);
  return (ip & info.maskInt) >>> 0 === info.networkInt;
}

export const SAMPLES = [
  { label: "家用局域网", value: "192.168.1.130/24" },
  { label: "大型企业", value: "10.20.30.40/16" },
  { label: "公网单 IP", value: "8.8.8.8/32" },
  { label: "点对点链路", value: "172.16.0.1/31" },
];
