// app/file-hash/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import {
  CheckCircle2,
  FileCheck2,
  Fingerprint,
  Play,
  Square,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import ToolShell from "@/components/ToolShell";
import { Badge, Button, CopyButton, Notice, OutputBlock, Segmented } from "@/components/ui/ToolUI";
import {
  HASH_ALGOS,
  MAX_FILES,
  type HashAlgo,
  type HashResponse,
  type Hashes,
} from "./constants";

interface FileItem {
  key: number;
  file: File;
  progress: number;
  status: "pending" | "running" | "done" | "error";
  hashes?: Hashes;
  error?: string;
}

const ALGO_COLORS: Record<HashAlgo, string> = {
  MD5: "bg-indigo-50 border-indigo-200 text-indigo-700",
  SHA1: "bg-blue-50 border-blue-200 text-blue-700",
  SHA256: "bg-emerald-50 border-emerald-200 text-emerald-700",
  SHA512: "bg-violet-50 border-violet-200 text-violet-700",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function normalizeHash(value: string) {
  return value.trim().toLowerCase().replace(/[\s:]/g, "");
}

export default function FileHashPage() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [running, setRunning] = useState(false);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [expected, setExpected] = useState("");
  const [compareAlgo, setCompareAlgo] = useState<HashAlgo>("SHA256");
  const [notice, setNotice] = useState("");

  const workerRef = useRef<Worker | null>(null);
  const nextKeyRef = useRef(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => {
    workerRef.current?.terminate();
  }, []);

  const addFiles = (files: FileList | File[]) => {
    if (running) return;
    const incoming = Array.from(files);
    const room = MAX_FILES - items.length;
    if (room <= 0) {
      setNotice(`最多同时处理 ${MAX_FILES} 个文件，请先移除部分文件`);
      return;
    }
    const count = Math.min(room, incoming.length);
    const base = nextKeyRef.current;
    nextKeyRef.current += count;
    const added: FileItem[] = incoming.slice(0, count).map((file, index) => ({
      key: base + index,
      file,
      progress: 0,
      status: "pending",
    }));
    setItems((prev) => [...prev, ...added]);
    setSelectedKey((prev) => prev ?? added[0]?.key ?? null);
    setNotice(incoming.length > count ? `已达到 ${MAX_FILES} 个文件上限，多余文件未加入` : "");
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  };

  const start = () => {
    if (running || !items.length) return;
    const queue = items;
    const worker = new Worker(new URL("./hash.worker.ts", import.meta.url));
    workerRef.current = worker;
    let index = 0;
    setRunning(true);
    setNotice("");

    const runNext = () => {
      if (index >= queue.length) {
        worker.terminate();
        workerRef.current = null;
        setRunning(false);
        return;
      }
      const key = queue[index].key;
      setItems((prev) =>
        prev.map((item) => item.key === key ? { ...item, status: "running", progress: 0, error: undefined } : item)
      );
      worker.postMessage({ id: key, file: queue[index].file });
    };

    worker.onmessage = (event: MessageEvent<HashResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        const percent = message.total ? Math.round((message.loaded / message.total) * 100) : 100;
        setItems((prev) =>
          prev.map((item) => item.key === message.id ? { ...item, progress: percent } : item)
        );
        return;
      }
      if (message.type === "done") {
        setItems((prev) =>
          prev.map((item) =>
            item.key === message.id
              ? { ...item, status: "done", hashes: message.hashes, progress: 100, error: undefined }
              : item
          )
        );
      } else {
        setItems((prev) =>
          prev.map((item) =>
            item.key === message.id ? { ...item, status: "error", error: message.message } : item
          )
        );
      }
      index += 1;
      runNext();
    };
    worker.onerror = () => {
      setNotice("计算线程异常，已停止；请刷新页面后重试");
      worker.terminate();
      workerRef.current = null;
      setRunning(false);
      setItems((prev) =>
        prev.map((item) => item.status === "running" ? { ...item, status: "pending" } : item)
      );
    };
    runNext();
  };

  const stop = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
    setItems((prev) =>
      prev.map((item) => item.status === "running" ? { ...item, status: "pending" } : item)
    );
  };

  const remove = (key: number) => {
    if (running) return;
    const rest = items.filter((item) => item.key !== key);
    setItems(rest);
    setSelectedKey((prev) => (prev === key ? rest[0]?.key ?? null : prev));
  };

  const clear = () => {
    stop();
    setItems([]);
    setSelectedKey(null);
    setExpected("");
    setNotice("");
  };

  const selected = items.find((item) => item.key === selectedKey) ?? items[0];
  const actual = selected?.hashes?.[compareAlgo];
  const hasExpected = expected.trim().length > 0;
  const matched = hasExpected && actual ? normalizeHash(expected) === normalizeHash(actual) : null;

  const report = useMemo(
    () =>
      items
        .filter((item) => item.hashes)
        .map((item) => `${item.hashes?.[compareAlgo] ?? ""}  ${item.file.name}`)
        .join("\n"),
    [items, compareAlgo]
  );

  return (
    <ToolShell>
      <div className="space-y-6">
        {/* 选择文件 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="ui-label text-sm">选择文件</span>
            <span className="text-xs text-slate-500">{items.length} / {MAX_FILES}</span>
          </div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFileChange} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            disabled={running}
            className="w-full p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors text-center disabled:opacity-60"
          >
            <UploadCloud size={28} className="mx-auto text-indigo-600 mb-2" />
            <div className="text-sm font-semibold text-slate-700">点击选择或拖拽文件到这里</div>
            <div className="text-xs text-slate-500 mt-1">可分块处理超大文件，最多 {MAX_FILES} 个，全程不上传</div>
          </button>
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.key}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  selected?.key === item.key ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedKey(item.key)}
                  className="flex-1 min-w-0 text-left"
                  aria-label={`查看 ${item.file.name} 的哈希结果`}
                >
                  <div className="text-sm text-slate-800 truncate">{item.file.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatSize(item.file.size)}</div>
                  {(item.status === "running" || item.progress > 0) && item.status !== "done" && (
                    <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 transition-all" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                </button>
                {item.status === "done" && <Badge className="bg-emerald-50 text-emerald-700 shrink-0">已完成</Badge>}
                {item.status === "running" && <Badge className="bg-indigo-50 text-indigo-700 shrink-0">{item.progress}%</Badge>}
                {item.status === "error" && <Badge className="bg-red-50 text-red-700 shrink-0">失败</Badge>}
                {item.status === "pending" && <Badge className="bg-slate-100 text-slate-600 shrink-0">待计算</Badge>}
                <Button variant="ghost" size="sm" onClick={() => remove(item.key)} disabled={running} aria-label={`移除 ${item.file.name}`}>
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button icon={Play} onClick={start} disabled={running || !items.length}>
            {running ? "计算中…" : "开始计算"}
          </Button>
          {running && <Button variant="secondary" icon={Square} onClick={stop}>停止</Button>}
          <Button variant="ghost" icon={Trash2} onClick={clear} disabled={!items.length && !expected}>清空</Button>
        </div>

        {notice && <Notice tone="info">{notice}</Notice>}
        {selected?.error && <Notice tone="error">{selected.file.name}：{selected.error}</Notice>}

        {/* 比对预期值 */}
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="ui-label text-sm flex items-center gap-2">
              <FileCheck2 size={16} className="text-indigo-600" /> 校验比对
            </span>
            <Segmented<HashAlgo>
              label="比对算法"
              value={compareAlgo}
              onChange={setCompareAlgo}
              options={HASH_ALGOS.map((algo) => ({ value: algo, label: algo }))}
            />
          </div>
          <label htmlFor="hash-expected" className="sr-only">预期哈希值</label>
          <input
            id="hash-expected"
            value={expected}
            onChange={(event) => setExpected(event.target.value)}
            spellCheck={false}
            placeholder="粘贴官方提供的哈希值，自动比对（忽略大小写、空格与冒号）"
            className="ui-input font-mono text-sm"
          />
          {matched !== null && (
            <Notice tone={matched ? "success" : "error"}>
              {matched
                ? `校验通过：${compareAlgo} 值与预期一致，文件完整。`
                : `校验失败：${compareAlgo} 值与预期不一致，请重新下载或核对来源。`}
              {matched ? <CheckCircle2 size={15} className="inline ml-1" /> : <XCircle size={15} className="inline ml-1" />}
            </Notice>
          )}
          {hasExpected && matched === null && (
            <Notice tone="info">请先选中文件并点击「开始计算」，得出结果后会自动比对。</Notice>
          )}
        </div>

        {/* 四种算法结果 */}
        <div className="space-y-3">
          <span className="ui-label text-sm flex items-center gap-2">
            <Fingerprint size={16} className="text-indigo-600" /> 计算结果
          </span>
          {HASH_ALGOS.map((algo) => {
            const value = selected?.hashes?.[algo] ?? "";
            return (
              <div key={algo} className={`flex items-center gap-3 p-3 rounded-xl border ${value ? ALGO_COLORS[algo] : "bg-slate-50 border-slate-200"}`}>
                <span className="font-mono font-semibold text-xs w-16 shrink-0">{algo}</span>
                <input
                  readOnly
                  value={value || "—"}
                  aria-label={`${algo} 哈希值`}
                  className="flex-1 min-w-0 bg-transparent border-0 font-mono text-xs truncate focus:outline-none"
                />
                <CopyButton value={value} label={`复制 ${algo} 哈希值`} />
              </div>
            );
          })}
        </div>

        <OutputBlock
          label="校验报告"
          hint={`${compareAlgo} 格式，可直接保存为 checksums.txt`}
          value={report}
          copyLabel="复制报告"
          filename="checksums.txt"
          placeholder="计算完成后会按「哈希值两个空格文件名」的格式汇总…"
          minHeight="min-h-[100px]"
          textareaClassName="text-xs"
        />

        <Notice tone="tip">
          计算在独立线程中分块进行，内存占用恒定，适合校验镜像、安装包等大文件。MD5 与 SHA-1 已不适合作为安全凭证，仅用于完整性校验。
        </Notice>
      </div>
    </ToolShell>
  );
}
