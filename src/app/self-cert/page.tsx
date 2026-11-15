"use client";

import { useMemo, useState } from "react";

import {
  Shield,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Laptop,
  CheckCircle2,
} from "lucide-react";

import ToolShell from "@/components/ToolShell";
import {
  Notice,
  OutputBlock,
  Button,
  IconButton,
  Badge,
  Panel,
  KeyRow,
} from "@/components/ui/ToolUI";

import {
  useCertGenerator,
  type SanEntry,
  type SanType,
} from "./useCertGenerator";
import { randomId } from "@/lib/random";

/** 严格 IPv4：四段、无前导零、每段 ≤255（forge.bytesFromIP 对非法值不抛错，必须自己挡住） */
function isIPv4Literal(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 4
    && parts.every((part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
}

/** 严格 IPv6：允许一次 :: 压缩与末尾 IPv4，禁止 zone id 与随意的 hex 串 */
function isIPv6Literal(value: string): boolean {
  if (!value.includes(":") || value.includes("%")) return false;
  const halves = value.split("::");
  if (halves.length > 2) return false;
  let groups = 0;
  for (const half of halves) {
    if (!half) continue;
    for (const part of half.split(":")) {
      if (!part) return false;
      if (part.includes(".")) {
        if (!isIPv4Literal(part)) return false;
        groups += 2;
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return false;
        groups += 1;
      }
    }
  }
  return halves.length === 2 ? groups <= 7 : groups === 8;
}

function validSan(entry: SanEntry): boolean {
  const value = entry.value.trim();
  if (!value) return false;
  if (entry.type === "IP") return isIPv4Literal(value) || isIPv6Literal(value);
  return /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i.test(value);
}

/** 域名 / IP 都算合法；不给类型，由内容自己判断 */
function validName(value: string): boolean {
  return validSan({
    id: "__",
    type: isIPv4Literal(value) || isIPv6Literal(value) ? "IP" : "DNS",
    value,
  });
}

/**
 * 证书名称支持一次填多个，用英文逗号分隔（顺带兼容中文逗号）。
 * X.509 的 CN 只有一个字段，所以第一个作为 CN，其余全部写进 SAN ——
 * 这也是多域名证书的实际做法，CN 本身在现代浏览器里已不参与校验。
 */
function splitNames(value: string): string[] {
  return value
    .split(/[,，]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function SelfCertPage() {
  const {
    result,
    error,
    isGenerating,
    generateCert,
    cost,
    nativeEngine,
  } = useCertGenerator();

  const [commonName, setCommonName] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [organization, setOrganization] = useState("");
  const [country, setCountry] = useState("");
  const [days, setDays] = useState(3650);
  const [keySize, setKeySize] = useState<2048 | 4096>(2048);
  const [hash, setHash] = useState<"sha256" | "sha384" | "sha512">("sha256");
  const [sanEntries, setSanEntries] = useState<SanEntry[]>([]);
  const [formError, setFormError] = useState("");

  const addSan = () => {
    setSanEntries((prev) => [
      ...prev,
      {
        id: randomId("san_"),
        type: "DNS",
        value: "",
      },
    ]);
  };

  const updateSanType = (id: string, type: SanType) => {
    setSanEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, type } : item))
    );
  };

  const removeSan = (id: string) => {
    setSanEntries((prev) => prev.filter((x) => x.id !== id));
  };

  const updateSan = (id: string, value: string) => {
    setSanEntries((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, value } : item
      )
    );
  };

  const names = useMemo(() => splitNames(commonName), [commonName]);

  const autoSans = useMemo<SanEntry[]>(
    () =>
      names.map((value, index) => ({
        id: `auto-${index}`,
        // 旧判断把任意含冒号的 hex 串（dead:beef、a:b）当成 IPv6，
        // node-forge 会静默写入垃圾字节，生成出浏览器无法校验的证书
        type: isIPv4Literal(value) || isIPv6Literal(value) ? "IP" : "DNS",
        value,
      })),
    [names]
  );

  const finalSan = useMemo(() => {
    const map = new Map<string, SanEntry>();

    autoSans.forEach((item) => {
      map.set(`${item.type}:${item.value}`.trim().toLowerCase(), item);
    });

    sanEntries.forEach((item) => {
      const key = `${item.type}:${item.value}`.trim().toLowerCase();

      if (item.value.trim() && !map.has(key)) {
        map.set(key, item);
      }
    });

    return Array.from(map.values());
  }, [autoSans, sanEntries]);

  /** 两个生成入口共用同一套校验，避免「localhost 开发证书」跳过国家代码检查 */
  const validate = (cnList: string[]): string | null => {
    if (!(cnList[0] ?? "").trim()) return "请输入证书名称";
    if (country.trim() && !/^[A-Za-z]{2}$/.test(country.trim())) {
      return "国家代码必须为 2 位字母，例如 CN、US、KR";
    }
    const invalidName = cnList.find((name) => !validName(name));
    if (invalidName) return `「${invalidName}」不是合法的域名或 IP 地址`;
    const invalid = sanEntries.find((entry) => entry.value.trim() && !validSan(entry));
    if (invalid) return `SAN「${invalid.type}: ${invalid.value}」不是合法的域名或 IP 地址`;
    return null;
  };

  const commonPayload = () => ({
    keySize,
    hash,
    days,
    organization: organization || undefined,
    country: country.trim().toUpperCase() || undefined,
  });

  const generate = () => {
    // 多个名称时 CN 只取第一个（单个字段放不下，也不参与现代浏览器校验）
    const cn = names[0] ?? "";
    const message = validate(names);
    if (message) {
      setFormError(message);
      return;
    }
    setFormError("");

    generateCert({
      ...commonPayload(),
      commonName: cn,
      sanEntries: finalSan,
    });
  };

  const generateLocalhost = () => {
    const message = validate(["localhost"]);
    if (message) {
      setFormError(message);
      return;
    }
    setFormError("");

    generateCert({
      ...commonPayload(),
      commonName: "localhost",
      sanEntries: [
        { id: "1", type: "DNS", value: "localhost" },
        { id: "2", type: "IP", value: "127.0.0.1" },
        { id: "3", type: "IP", value: "::1" },
      ],
    });
  };

  return (
    <ToolShell>
      <div className="space-y-6">
        {/* 页面标题与描述由 ToolShell 统一渲染，这里不再重复 */}
        <div className="ui-panel-muted space-y-5">
          <div>
            <label htmlFor="cert-cn" className="ui-label text-sm">证书名称 (CN)</label>
            <input
              id="cert-cn"
              value={commonName}
              onChange={(e) => setCommonName(e.target.value)}
              placeholder="example.com，或用英文逗号填多个：example.com, www.example.com, 192.168.1.100"
              className="ui-input mt-2"
            />
            {names.length > 1 && (
              <p className="ui-prose mt-2 text-xs text-slate-500 leading-relaxed">
                已识别 {names.length} 个名称：CN 取第一个「{names[0]}」，其余全部写入 SAN。
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="ui-label text-sm">SAN 扩展</span>
              <Button variant="ghost" size="sm" icon={Plus} onClick={addSan}>
                添加
              </Button>
            </div>

            <div className="space-y-2">
              {autoSans.map((item, index) => (
                <div key={item.id} className="flex gap-2">
                  <Badge className="ui-badge-success w-20 shrink-0 justify-center">
                    {index === 0 ? "CN" : "SAN"}
                  </Badge>
                  <input
                    readOnly
                    value={`${item.type}: ${item.value}`}
                    aria-label={index === 0 ? "由证书名称自动生成的 CN" : "由证书名称自动生成的 SAN"}
                    className="ui-input ui-input-sm bg-slate-50"
                  />
                </div>
              ))}

              {sanEntries.map((item) => (
                <div key={item.id} className="flex gap-2">
                  <select
                    value={item.type}
                    onChange={(e) => updateSanType(item.id, e.target.value as SanType)}
                    aria-label="SAN 类型"
                    className="ui-select ui-input-sm w-24 shrink-0"
                  >
                    <option value="DNS">DNS</option>
                    <option value="IP">IP</option>
                  </select>
                  <input
                    value={item.value}
                    onChange={(e) => updateSan(item.id, e.target.value)}
                    placeholder={item.type === "IP" ? "如 10.0.0.1 或 ::1" : "如 api.example.com"}
                    aria-label="SAN 值"
                    className="ui-input ui-input-sm"
                  />
                  <IconButton
                    label="删除该 SAN"
                    onClick={() => removeSan(item.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="ui-btn ui-btn-ghost ui-btn-sm"
            >
              高级选项
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showAdvanced && (
              <div className="ui-form-grid mt-4">
                <input
                  placeholder="组织(O)"
                  aria-label="组织 (O)"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="ui-input"
                />

                <input
                  placeholder="国家(C)"
                  aria-label="国家代码 (C)，2 位字母"
                  maxLength={2}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="ui-input"
                />

                <input
                  type="number"
                  aria-label="有效期（天）"
                  min={1}
                  max={3650}
                  value={days}
                  onChange={(e) =>
                    setDays(
                      Math.min(3650, Math.max(1, Number(e.target.value)))
                    )
                  }
                  className="ui-input"
                />

                <select
                  aria-label="密钥长度"
                  value={keySize}
                  onChange={(e) =>
                    setKeySize(Number(e.target.value) as 2048 | 4096)
                  }
                  className="ui-select"
                >
                  <option value={2048}>RSA 2048</option>
                  <option value={4096}>RSA 4096</option>
                </select>

                <select
                  aria-label="签名算法"
                  value={hash}
                  onChange={(e) =>
                    setHash(
                      e.target.value as "sha256" | "sha384" | "sha512"
                    )
                  }
                  className="ui-select"
                >
                  <option value="sha256">SHA256</option>
                  <option value="sha384">SHA384</option>
                  <option value="sha512">SHA512</option>
                </select>
              </div>
            )}
          </div>

          {formError && <Notice tone="error">{formError}</Notice>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              icon={Shield}
              disabled={isGenerating}
              onClick={generate}
              className="w-full py-3"
            >
              {isGenerating ? "生成中..." : "生成证书"}
            </Button>

            <Button
              variant="secondary"
              icon={Laptop}
              disabled={isGenerating}
              onClick={generateLocalhost}
              className="w-full py-3"
            >
              localhost 开发证书
            </Button>
          </div>

          {error && <Notice tone="error">{error}</Notice>}

          {isGenerating && nativeEngine && (
            <Notice tone="info">
              正在用浏览器原生加密接口生成密钥并签名，通常 1 秒内完成，请勿关闭页面。
            </Notice>
          )}

          {isGenerating && !nativeEngine && (
            <Notice tone="tip">
              当前浏览器没有提供原生加密接口（需要 HTTPS 或 localhost，部分内置浏览器也不支持），
              只能用纯 JS 实现，2048 位约 10–40 秒、4096 位更久，期间页面会无响应。建议改用 2048 位或换桌面浏览器。
            </Notice>
          )}

          <p className="ui-prose text-xs text-slate-500 leading-relaxed">
            自签证书不会被系统和浏览器信任，仅适合内网服务、本地开发与测试；对外站点请使用权威 CA 签发的证书。
          </p>
        </div>

        {result && (
          <div className="space-y-5">
            <Panel icon={CheckCircle2} title="证书生成成功">
              <div className="ui-kv-list">
                <KeyRow label="算法" value={`RSA ${result.info.keySize}`} />
                <KeyRow label="签名算法" value={result.info.hash} mono />
                <KeyRow label="耗时" value={`${cost} 秒（${result.source === "webcrypto" ? "原生加密接口" : "JS 实现"}）`} />
                <KeyRow
                  label="生效时间"
                  value={new Date(result.info.notBefore).toLocaleString()}
                />
                <KeyRow
                  label="过期时间"
                  value={new Date(result.info.notAfter).toLocaleString()}
                />
              </div>

              <div className="mt-4">
                <div className="text-slate-500 text-sm mb-2">SAN 扩展</div>
                <div className="flex flex-wrap gap-2">
                  {result.info.san.map((item, index) => (
                    <Badge
                      key={index}
                      className="border border-slate-200 bg-white text-slate-600"
                    >
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            </Panel>

            <OutputBlock
              label="private-key.pem"
              hint="请妥善保管，遗失不可恢复"
              tone="warning"
              value={result.privateKey}
              copyLabel="复制私钥"
              filename="private-key.pem"
              mimeType="application/x-pem-file;charset=utf-8"
              textareaClassName="text-xs"
            />

            <OutputBlock
              label="certificate.pem"
              value={result.certificate}
              copyLabel="复制证书"
              filename="certificate.pem"
              mimeType="application/x-pem-file;charset=utf-8"
              textareaClassName="text-xs"
            />
          </div>
        )}
      </div>
    </ToolShell>
  );
}
