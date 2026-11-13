// app/text-tools/page.tsx
"use client";

import { useMemo, useState } from "react";
import {
  AlignLeft, ArrowDownToLine, BarChart3, Eraser, Type, WandSparkles,
} from "lucide-react";
import ToolShell from "@/components/ToolShell";
import {
  Button, IconButton, Notice, OutputBlock, Panel, KeyRow,
} from "@/components/ui/ToolUI";
import {
  changeCase, fromBase64, fromHexBytes, htmlDecode, htmlEncode,
  normalizeWhitespace, processLines, textStats, toBase64, toFullWidth,
  toHalfWidth, toHexBytes, unicodeEscape, unicodeUnescape, urlDecode,
  urlEncode,
} from "./text-utils";

const SAMPLE = "Hello World！工具箱 Text-Tools\n第二行：hello_world\n第二行：hello_world";

type ToolGroup = {
  title: string;
  icon: typeof Type;
  items: { label: string; run: (text: string) => string }[];
};

const GROUPS: ToolGroup[] = [
  {
    title: "编码 / 解码",
    icon: WandSparkles,
    items: [
      { label: "URL 编码", run: (t) => urlEncode(t) },
      { label: "URL 解码", run: (t) => urlDecode(t) },
      { label: "表单编码", run: (t) => urlEncode(t, true) },
      { label: "表单解码", run: (t) => urlDecode(t, true) },
      { label: "HTML 实体编码", run: htmlEncode },
      { label: "HTML 实体解码", run: htmlDecode },
      { label: "Unicode 转义", run: unicodeEscape },
      { label: "Unicode 还原", run: unicodeUnescape },
      { label: "转十六进制", run: toHexBytes },
      { label: "十六进制还原", run: fromHexBytes },
      { label: "Base64 编码", run: toBase64 },
      { label: "Base64 解码", run: fromBase64 },
      { label: "转全角", run: toFullWidth },
      { label: "转半角", run: toHalfWidth },
    ],
  },
  {
    title: "大小写 / 命名",
    icon: Type,
    items: [
      { label: "全部大写", run: (t) => changeCase(t, "upper") },
      { label: "全部小写", run: (t) => changeCase(t, "lower") },
      { label: "反转大小写", run: (t) => changeCase(t, "invert") },
      { label: "单词首字母大写", run: (t) => changeCase(t, "title") },
      { label: "句首字母大写", run: (t) => changeCase(t, "sentence") },
      { label: "camelCase", run: (t) => changeCase(t, "camel") },
      { label: "PascalCase", run: (t) => changeCase(t, "pascal") },
      { label: "snake_case", run: (t) => changeCase(t, "snake") },
      { label: "kebab-case", run: (t) => changeCase(t, "kebab") },
      { label: "CONSTANT_CASE", run: (t) => changeCase(t, "constant") },
    ],
  },
  {
    title: "行 / 字符处理",
    icon: AlignLeft,
    items: [
      { label: "行去重（保序）", run: (t) => processLines(t, "dedupe") },
      { label: "行排序 ↑", run: (t) => processLines(t, "sort") },
      { label: "行排序 ↓", run: (t) => processLines(t, "sortDesc") },
      { label: "反转行序", run: (t) => processLines(t, "reverse") },
      { label: "随机打乱行", run: (t) => processLines(t, "shuffle") },
      { label: "每行去首尾空格", run: (t) => processLines(t, "trim") },
      { label: "删除空行", run: (t) => processLines(t, "dropEmpty") },
      { label: "添加行号", run: (t) => processLines(t, "number") },
      { label: "合并为一行", run: (t) => processLines(t, "join") },
      { label: "字符去重", run: (t) => processLines(t, "uniqueChars") },
      { label: "合并多余空格", run: (t) => normalizeWhitespace(t, "collapse") },
      { label: "统一换行符", run: (t) => normalizeWhitespace(t, "linebreak") },
      { label: "Tab 转空格", run: (t) => normalizeWhitespace(t, "tabs") },
      { label: "合并连续空行", run: (t) => normalizeWhitespace(t, "blankLines") },
      { label: "删除所有空白", run: (t) => normalizeWhitespace(t, "compact") },
    ],
  },
];

function StatGrid({ stats }: { stats: ReturnType<typeof textStats> }) {
  const rows: [string, string][] = [
    ["字符数（含空白）", String(stats.chars)],
    ["字符数（不含空白）", String(stats.charsNoSpace)],
    ["字数（中文按字 / 英文按词）", String(stats.words)],
    ["行数", String(stats.lines)],
    ["段落数", String(stats.paragraphs)],
    ["UTF-8 字节数", String(stats.bytes)],
    ["中文字", String(stats.cjk)],
    ["英文字母 / 数字", `${stats.letters} / ${stats.digits}`],
  ];
  return (
    <div className="ui-kv-list grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
      {rows.map(([label, value]) => (
        <KeyRow key={label} label={label} value={value} mono />
      ))}
    </div>
  );
}

export default function TextToolsPage() {
  const [input, setInput] = useState(SAMPLE);
  const [output, setOutput] = useState("");
  const [label, setLabel] = useState("转换结果");
  const [error, setError] = useState("");

  const stats = useMemo(() => textStats(input), [input]);

  const apply = (name: string, run: (text: string) => string) => {
    try {
      setOutput(run(input));
      setLabel(name);
      setError("");
    } catch (cause) {
      setError(`${name}失败：${cause instanceof Error ? cause.message : "输入格式不合法"}`);
    }
  };

  return (
    <ToolShell>
      <Panel icon={Type} title="输入文本">
        <textarea
          id="text-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="粘贴或输入要处理的文本…"
          className="ui-textarea min-h-[180px]"
          spellCheck={false}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
          <span className="text-xs text-slate-500">共 {stats.chars} 字符 · {stats.lines} 行</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={Eraser} onClick={() => { setInput(""); setOutput(""); setError(""); }}>清空</Button>
            <Button variant="secondary" size="sm" onClick={() => setInput(SAMPLE)}>填入示例</Button>
          </div>
        </div>
      </Panel>

      {GROUPS.map((group) => (
        <Panel key={group.title} icon={group.icon} title={group.title} className="mt-5">
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => (
              <Button key={item.label} variant="secondary" size="sm" onClick={() => apply(item.label, item.run)}>
                {item.label}
              </Button>
            ))}
          </div>
        </Panel>
      ))}

      {error && <Notice tone="error" className="mt-5">{error}</Notice>}

      <div className="mt-5">
        <OutputBlock
          label={label}
          hint="点击上方任意工具即可转换，可连续处理"
          value={output}
          filename="text-tools-result.txt"
          minHeight="min-h-[160px]"
          placeholder="转换结果会显示在这里"
          actions={
            <IconButton
              label="把结果写回输入框，继续处理"
              disabled={!output}
              onClick={() => setInput(output)}
            >
              <ArrowDownToLine size={16} />
            </IconButton>
          }
        />
      </div>

      <Panel icon={BarChart3} title="文本统计" className="mt-5">
        <StatGrid stats={stats} />
      </Panel>

      <Notice tone="tip" className="mt-5">
        所有转换都只改文本、不改动原始输入；想连续处理多步，点结果右上角的「写回输入框」即可。URL 编码默认用 %20，表单编码会把空格写成 +。
      </Notice>
    </ToolShell>
  );
}
