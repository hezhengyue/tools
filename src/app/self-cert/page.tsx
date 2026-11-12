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
} from "./useCertGenerator";

export default function SelfCertPage() {
  const {
    result,
    error,
    isGenerating,
    generateCert,
  } = useCertGenerator();

  const [commonName, setCommonName] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [organization, setOrganization] = useState("");
  const [country, setCountry] = useState("");
  const [days, setDays] = useState(3650);
  const [keySize, setKeySize] = useState<2048 | 4096>(2048);
  const [hash, setHash] = useState<"sha256" | "sha384" | "sha512">("sha256");
  const [sanEntries, setSanEntries] = useState<SanEntry[]>([]);

  const addSan = () => {
    setSanEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "DNS",
        value: "",
      },
    ]);
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

  const autoSan = useMemo(() => {
    const value = commonName.trim();

    if (!value) {
      return null;
    }

    const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
    const isIPv6 = value.includes(":");
    const isIP = isIPv4 || isIPv6;

    return {
      id: "auto-cn",
      type: isIP ? "IP" : "DNS",
      value,
    } as SanEntry;
  }, [commonName]);

  const finalSan = useMemo(() => {
    const map = new Map<string, SanEntry>();

    if (autoSan) {
      map.set(`${autoSan.type}:${autoSan.value}`.toLowerCase(), autoSan);
    }

    sanEntries.forEach((item) => {
      const key = `${item.type}:${item.value}`.trim().toLowerCase();

      if (item.value.trim() && !map.has(key)) {
        map.set(key, item);
      }
    });

    return Array.from(map.values());
  }, [autoSan, sanEntries]);

  const generate = () => {
    const cn = commonName.trim();

    if (!cn) {
      alert("请输入证书名称");
      return;
    }

    if (country && !/^[A-Za-z]{2}$/.test(country)) {
      alert("国家代码必须为2位字母，例如 CN、US、KR");
      return;
    }

    generateCert({
      commonName: cn,
      sanEntries: finalSan,
      keySize,
      hash,
      days,
      organization: organization || undefined,
      country: country.trim().toUpperCase() || undefined,
    });
  };

  const generateLocalhost = () => {
    generateCert({
      commonName: "localhost",
      sanEntries: [
        { id: "1", type: "DNS", value: "localhost" },
        { id: "2", type: "IP", value: "127.0.0.1" },
        { id: "3", type: "IP", value: "::1" },
      ],
      keySize,
      hash,
      days,
      organization: organization || undefined,
      country: country.trim().toUpperCase() || undefined,
    });
  };

  return (
    <ToolShell>
      <div className="space-y-6">
        {/* 页面标题与描述由 ToolShell 统一渲染，这里不再重复 */}
        <div className="ui-panel-muted space-y-5">
          <div>
            <label className="ui-label text-sm">证书名称 (CN)</label>
            <input
              value={commonName}
              onChange={(e) => setCommonName(e.target.value)}
              placeholder="example.com、*.example.com、192.168.1.100"
              className="ui-input mt-2"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <label className="ui-label text-sm">SAN 扩展</label>
              <Button variant="ghost" size="sm" icon={Plus} onClick={addSan}>
                添加
              </Button>
            </div>

            <div className="space-y-2">
              {autoSan && (
                <div className="flex gap-2">
                  <Badge className="ui-badge-success w-20 shrink-0 justify-center">
                    AUTO
                  </Badge>
                  <input
                    readOnly
                    value={`${autoSan.type}: ${autoSan.value}`}
                    className="ui-input ui-input-sm bg-slate-50"
                  />
                </div>
              )}

              {sanEntries.map((item) => (
                <div key={item.id} className="flex gap-2">
                  <input
                    value={item.value}
                    onChange={(e) => updateSan(item.id, e.target.value)}
                    placeholder="额外SAN"
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
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <input
                  placeholder="组织(O)"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="ui-input"
                />

                <input
                  placeholder="国家(C)"
                  maxLength={2}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="ui-input"
                />

                <input
                  type="number"
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
        </div>

        {result && (
          <div className="space-y-5">
            <Panel icon={CheckCircle2} title="证书生成成功">
              <div className="ui-kv-list">
                <KeyRow label="算法" value={`RSA ${result.info.keySize}`} />
                <KeyRow label="签名算法" value={result.info.hash} mono />
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
              minHeight="min-h-[250px]"
              textareaClassName="text-xs"
            />

            <OutputBlock
              label="certificate.pem"
              value={result.certificate}
              copyLabel="复制证书"
              filename="certificate.pem"
              mimeType="application/x-pem-file;charset=utf-8"
              minHeight="min-h-[250px]"
              textareaClassName="text-xs"
            />
          </div>
        )}
      </div>
    </ToolShell>
  );
}
