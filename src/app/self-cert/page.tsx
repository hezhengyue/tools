// app/self-cert/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Download, RefreshCw, Plus, Trash2, Shield, Info } from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { useCertGenerator, type SanEntry } from "./useCertGenerator";

function SelfCertCore() {
  const [commonName, setCommonName] = useState("localhost");
  const [sanEntries, setSanEntries] = useState<SanEntry[]>([
    { id: "1", type: "DNS", value: "localhost" },
  ]);
  const [keySize, setKeySize] = useState<2048 | 4096>(2048);
  const [hash, setHash] = useState<"sha256" | "sha384" | "sha512">("sha256");
  const [days, setDays] = useState(3650);
  const [organization, setOrganization] = useState("");
  const [country, setCountry] = useState("");
  
  const [copied, setCopied] = useState<"key" | "crt" | null>(null);
  
  const { result, isGenerating, error, generateCert } = useCertGenerator();

  // 添加 SAN 条目
  const addSanEntry = () => {
    const id = `san_${Date.now()}`;
    setSanEntries([...sanEntries, { id, type: "DNS", value: "" }]);
  };

  // 更新 SAN 条目
  const updateSanEntry = (id: string, field: keyof SanEntry, value: string) => {
    setSanEntries(sanEntries.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  // 删除 SAN 条目
  const removeSanEntry = (id: string) => {
    if (sanEntries.length <= 1) return; // 至少保留一个
    setSanEntries(sanEntries.filter(entry => entry.id !== id));
  };

  // 生成证书
  const handleGenerate = () => {
    // 验证输入
    const validSan = sanEntries.filter(e => e.value.trim());
    if (!commonName.trim() || validSan.length === 0) {
      alert("请填写通用名称 (CN) 和至少一个 SAN 条目");
      return;
    }
    
    generateCert({
      commonName: commonName.trim(),
      sanEntries: validSan,
      keySize,
      hash,
      days,
      organization: organization.trim() || undefined,
      country: country.trim().toUpperCase() || undefined,
    });
  };

  // 复制功能
  const copyToClipboard = async (text: string, type: "key" | "crt") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 1500);
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  // 下载功能
  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "application/x-pem-file" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 快速填充示例
  const fillExample = (type: "ip" | "domain") => {
    if (type === "ip") {
      setCommonName("192.168.1.100");
      setSanEntries([
        { id: "1", type: "IP", value: "192.168.1.100" },
        { id: "2", type: "DNS", value: "hostname" },
      ]);
    } else {
      setCommonName("hezhengyue.com");
      setSanEntries([
        { id: "1", type: "DNS", value: "hezhengyue.com" },
        { id: "2", type: "DNS", value: "hostname" },
      ]);
    }
  };

  return (
    <>
      {/* 快速示例按钮 */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => fillExample("ip")}
          className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
        >
          📍 填充 IP 示例
        </button>
        <button
          onClick={() => fillExample("domain")}
          className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
        >
          🌐 填充域名示例
        </button>
      </div>

      {/* 表单区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 左侧：证书信息 */}
        <div className="space-y-4">
          <div>
            <label className="font-semibold text-slate-700 block mb-2">通用名称 (CN) *</label>
            <input
              type="text"
              value={commonName}
              onChange={(e) => setCommonName(e.target.value)}
              placeholder="如: localhost, 192.168.1.100, hezhengyue.com"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-2">SAN 扩展 (Subject Alternative Name) *</label>
            <div className="space-y-2">
              {sanEntries.map((entry) => (
                <div key={entry.id} className="flex gap-2">
                  <select
                    value={entry.type}
                    onChange={(e) => updateSanEntry(entry.id, "type", e.target.value as any)}
                    className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="DNS">DNS</option>
                    <option value="IP">IP</option>
                    <option value="Email">Email</option>
                    <option value="URI">URI</option>
                  </select>
                  <input
                    type="text"
                    value={entry.value}
                    onChange={(e) => updateSanEntry(entry.id, "value", e.target.value)}
                    placeholder={entry.type === "IP" ? "192.168.1.100" : entry.type === "DNS" ? "hezhengyue.com" : "value"}
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    onClick={() => removeSanEntry(entry.id)}
                    disabled={sanEntries.length <= 1}
                    className="p-2.5 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    title="删除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addSanEntry}
              className="mt-2 flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <Plus size={14} /> 添加 SAN 条目
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-2">国家代码 (C)</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="如: CN, US"
                maxLength={2}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl uppercase focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-2">组织 (O)</label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="如: My Company"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* 右侧：证书参数 */}
        <div className="space-y-4">
          <div>
            <label className="font-semibold text-slate-700 block mb-2">密钥长度</label>
            <div className="grid grid-cols-2 gap-3">
              {[2048, 4096].map((size) => (
                <button
                  key={size}
                  onClick={() => setKeySize(size as 2048 | 4096)}
                  disabled={isGenerating}
                  className={`p-3 rounded-xl text-left transition-all border disabled:opacity-50 ${
                    keySize === size
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  <div className="font-medium">{size} 位</div>
                  <div className="text-xs opacity-80">{size === 2048 ? "推荐" : "更高安全"}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-2">签名哈希</label>
            <select
              value={hash}
              onChange={(e) => setHash(e.target.value as any)}
              disabled={isGenerating}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:opacity-50"
            >
              <option value="sha256">SHA-256 (推荐)</option>
              <option value="sha384">SHA-384</option>
              <option value="sha512">SHA-512</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-2">有效期 (天)</label>
            <input
              type="number"
              min={1}
              max={36500}
              value={days}
              onChange={(e) => setDays(Math.max(1, Math.min(36500, Number(e.target.value))))}
              disabled={isGenerating}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:opacity-50"
            />
            <div className="text-xs text-slate-400 mt-1">
              默认 3650 天 (10 年)，自签证书建议设置合理有效期
            </div>
          </div>
        </div>
      </div>

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full flex items-center justify-center py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 hover:-translate-y-0.5 transition-all shadow-md shadow-indigo-600/20 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        <Shield size={18} className="mr-2" />
        {isGenerating ? "生成证书中..." : "生成自签名证书"}
      </button>

      {/* 错误提示 */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
          <span>⚠️</span>
          {error}
        </div>
      )}

      {/* 证书结果 */}
      {result && !isGenerating && (
        <div className="mt-8 space-y-6">
          {/* 证书信息摘要 */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Info size={16} /> 证书信息
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">使用者 (Subject):</span>
                <div className="font-mono text-slate-700">{result.info.subject}</div>
              </div>
              <div>
                <span className="text-slate-400">颁发者 (Issuer):</span>
                <div className="font-mono text-slate-700">{result.info.issuer}</div>
              </div>
              <div>
                <span className="text-slate-400">生效时间:</span>
                <div className="font-mono text-slate-700">{new Date(result.info.notBefore).toLocaleString("zh-CN")}</div>
              </div>
              <div>
                <span className="text-slate-400">过期时间:</span>
                <div className="font-mono text-slate-700">{new Date(result.info.notAfter).toLocaleString("zh-CN")}</div>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400">SAN 扩展:</span>
                <div className="font-mono text-slate-700 mt-1 flex flex-wrap gap-2">
                  {result.info.san.map((san, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-200 rounded text-xs">{san}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 私钥 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full" />
                私钥 (.key) ⚠️ 请妥善保存
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadFile(result.privateKey, `${commonName}.key`)}
                  className="p-2 text-slate-500 hover:text-indigo-600 transition-colors"
                  title="下载 .key 文件"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => copyToClipboard(result.privateKey, "key")}
                  className={`p-2 rounded-lg transition-all ${
                    copied === "key"
                      ? "bg-green-100 text-green-600"
                      : "bg-white border border-slate-200 text-slate-500 hover:text-indigo-600"
                  }`}
                  title={copied === "key" ? "已复制" : "复制私钥"}
                >
                  {copied === "key" ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={result.privateKey}
              className="w-full p-4 bg-amber-50/50 border border-amber-200 rounded-2xl font-mono text-xs text-slate-700 min-h-[200px] resize-none focus:outline-none"
            />
          </div>

          {/* 证书 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                证书 (.crt)
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadFile(result.certificate, `${commonName}.crt`)}
                  className="p-2 text-slate-500 hover:text-indigo-600 transition-colors"
                  title="下载 .crt 文件"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => copyToClipboard(result.certificate, "crt")}
                  className={`p-2 rounded-lg transition-all ${
                    copied === "crt"
                      ? "bg-green-100 text-green-600"
                      : "bg-white border border-slate-200 text-slate-500 hover:text-indigo-600"
                  }`}
                  title={copied === "crt" ? "已复制" : "复制证书"}
                >
                  {copied === "crt" ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={result.certificate}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-700 min-h-[280px] resize-none focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* 使用说明 */}
      <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
        <h4 className="font-semibold text-slate-700 mb-3">📋 使用说明</h4>
        <ul className="text-sm text-slate-600 space-y-2">
          <li>• <strong>IP 证书</strong>: CN 和 SAN 中至少一个填 IP 地址，如 <code>192.168.1.100</code></li>
          <li>• <strong>域名证书</strong>: CN 和 SAN 中填域名，如 <code>*.hezhengyue.com</code> 支持通配符</li>
          <li>• <strong>安装证书</strong>: 将 <code>.crt</code> 导入系统/浏览器信任存储，<code>.key</code> 用于服务端配置</li>
          <li>• <strong>验证证书</strong>: <code>openssl x509 -in cert.crt -text -noout</code></li>
          <li>• <strong>⚠️ 注意</strong>: 自签证书不会被浏览器默认信任，需手动添加例外</li>
        </ul>
      </div>
    </>
  );
}

export default function SelfCertPage() {
  return (
    <ToolShell>
      <SelfCertCore />
    </ToolShell>
  );
}