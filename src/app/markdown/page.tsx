// app/markdown/page.tsx
"use client";

import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { Marked, marked } from "marked";
import TurndownService from "turndown";
import {
  FileCode2, FileText, ListTree, Printer, RefreshCw,
} from "lucide-react";
import ToolShell from "@/components/ToolShell";
import {
  Button, DownloadButton, IconButton, Notice, OutputBlock, Panel,
  Segmented, Switch,
} from "@/components/ui/ToolUI";

type Mode = "preview" | "to-markdown";

const MD_SAMPLE = `# 正月工具箱

一个**纯前端**的工具站，所有计算都在浏览器本地完成。

## 特性

- 无需登录、无需上传文件
- 支持 \`Markdown\`、表格、代码块与任务列表
- [查看项目](https://github.com/hezhengyue/tools)

> 提示：右侧预览的 HTML 会先经过 DOMPurify 净化。

### 代码示例

\`\`\`ts
const greet = (name: string) => \`Hello, \${name}!\`;
console.log(greet("tools"));
\`\`\`

| 工具 | 分类 | 本地处理 |
| --- | --- | --- |
| 正则测试器 | 文本处理 | 是 |
| 二维码 | 实用工具 | 是 |

- [x] 支持 GFM 表格
- [ ] 支持导出 PDF

---

*斜体* 与 ~~删除线~~ 也可以正常渲染。`;

const HTML_SAMPLE = `<h1>示例文档</h1>
<p>这是一段 <strong>HTML</strong>，包含一个<a href="https://example.com">链接</a>。</p>
<ul>
  <li>第一项</li>
  <li>第二项</li>
</ul>
<pre><code class="language-js">console.log("hello");</code></pre>`;

/** 导出成独立 HTML 文件时用的内嵌样式 */
const EXPORT_CSS = `body{max-width:760px;margin:40px auto;padding:0 20px;font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1e293b}
h1,h2,h3{color:#0f172a;margin:1.4em 0 .6em}h1{font-size:1.8em;border-bottom:1px solid #e2e8f0;padding-bottom:.3em}
a{color:#4f46e5}blockquote{border-left:4px solid #c7d2fe;background:#eef2ff;margin:1em 0;padding:.6em 1em;color:#475569}
code{background:#f1f5f9;padding:.15em .4em;border-radius:4px;font-size:.9em}pre{background:#0f172a;color:#e2e8f0;padding:16px;border-radius:12px;overflow:auto}pre code{background:none;color:inherit;padding:0}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left}th{background:#f8fafc}
img{max-width:100%}hr{border:0;border-top:1px solid #e2e8f0;margin:2em 0}`;

interface TocItem { depth: number; text: string; id: string }

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 给标题加与大纲一致的 id，纯字符串处理，SSR 与客户端结果一致 */
function addHeadingIds(html: string): string {
  let index = 0;
  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_all, level: string, inner: string) => {
    index += 1;
    return `<h${level} id="md-heading-${index}">${inner}</h${level}>`;
  });
}

function buildToc(source: string): TocItem[] {
  const items: TocItem[] = [];
  for (const token of marked.lexer(source)) {
    if (token.type === "heading") {
      const id = `md-heading-${items.length + 1}`;
      items.push({ depth: token.depth, text: token.text, id });
    }
  }
  return items;
}

const SANITIZE_CONFIG = {
  ADD_ATTR: ["id", "target"],
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "style"],
  FORBID_ATTR: ["style", "onerror", "onload"],
};

export default function MarkdownPage() {
  const [mode, setMode] = useState<Mode>("preview");
  const [source, setSource] = useState(MD_SAMPLE);
  const [htmlInput, setHtmlInput] = useState(HTML_SAMPLE);
  const [gfm, setGfm] = useState(true);
  const [breaks, setBreaks] = useState(false);
  const [allowHtml, setAllowHtml] = useState(false);
  const [html, setHtml] = useState("");
  const [toc, setToc] = useState<TocItem[]>([]);
  const [resultMd, setResultMd] = useState("");
  const [error, setError] = useState("");

  // DOMPurify / Turndown 依赖 DOM，统一在客户端 effect 里计算；
  // queueMicrotask 避免 effect 内同步 setState（React Compiler 规则）。
  useEffect(() => {
    queueMicrotask(() => {
      try {
        if (mode === "preview") {
          const engine = new Marked({ gfm, breaks });
          if (!allowHtml) {
            engine.use({ renderer: { html: ({ text }: { text: string }) => escapeHtml(text) } });
          }
          const raw = engine.parse(source, { async: false }) as string;
          setHtml(DOMPurify.sanitize(addHeadingIds(raw), SANITIZE_CONFIG));
          setToc(buildToc(source));
        } else {
          const clean = DOMPurify.sanitize(htmlInput, SANITIZE_CONFIG);
          const service = new TurndownService({
            headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-",
            emDelimiter: "*", strongDelimiter: "**",
          });
          setResultMd(service.turndown(clean));
        }
        setError("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "转换失败，请检查输入内容");
      }
    });
  }, [mode, source, htmlInput, gfm, breaks, allowHtml]);

  const fullHtml = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Markdown 导出</title><style>${EXPORT_CSS}</style></head><body>
${html}
</body></html>`;

  const stats = {
    chars: Array.from(source).length,
    lines: source.split("\n").length,
    headings: toc.length,
  };

  return (
    <ToolShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <Segmented
          label="转换方向"
          value={mode}
          onChange={(next) => { setMode(next); setError(""); }}
          options={[
            { value: "preview", label: "Markdown → 预览 / HTML", icon: FileText },
            { value: "to-markdown", label: "HTML → Markdown", icon: FileCode2 },
          ]}
        />
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => {
          if (mode === "preview") setSource(MD_SAMPLE); else setHtmlInput(HTML_SAMPLE);
        }}>恢复示例</Button>
      </div>

      {mode === "preview" ? (
        <>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4">
            <Switch id="md-gfm" checked={gfm} onChange={setGfm} label="GFM 表格 / 任务列表" />
            <Switch id="md-breaks" checked={breaks} onChange={setBreaks} label="单换行转 <br>" />
            <Switch id="md-html" checked={allowHtml} onChange={setAllowHtml} label="允许内嵌 HTML" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel icon={FileText} title="Markdown 源码">
              <textarea
                id="md-source"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className="ui-textarea min-h-[420px] lg:min-h-[520px]"
                spellCheck={false}
                aria-label="Markdown 源码"
              />
              <div className="text-xs text-slate-500 mt-2">{stats.chars} 字符 · {stats.lines} 行 · {stats.headings} 个标题</div>
            </Panel>
            <Panel icon={FileCode2} title="实时预览" className="md-print-root">
              <div
                className="md-preview min-h-[420px] lg:min-h-[520px] max-h-[680px] overflow-y-auto pr-1"
                // HTML 已由 DOMPurify 净化，且剥离了 script / 事件属性
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </Panel>
          </div>

          {toc.length > 0 && (
            <Panel icon={ListTree} title="文档大纲" className="mt-5">
              <div className="flex flex-wrap gap-2">
                {toc.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                    style={{ marginLeft: `${(item.depth - 1) * 8}px` }}
                  >
                    {item.text}
                  </button>
                ))}
              </div>
            </Panel>
          )}

          <div className="mt-5">
            <OutputBlock
              label="生成的 HTML 片段"
              hint="已净化，可直接嵌入页面"
              value={html}
              filename="markdown-output.html"
              mimeType="text/html;charset=utf-8"
              minHeight="min-h-[140px]"
              textareaClassName="text-xs"
              actions={
                <>
                  <DownloadButton value={fullHtml} filename="document.html" mimeType="text/html;charset=utf-8" label="导出完整 HTML 文件" />
                  <IconButton label="打印或另存为 PDF" onClick={() => window.print()}><Printer size={16} /></IconButton>
                </>
              }
            />
          </div>
        </>
      ) : (
        <>
          <Panel icon={FileCode2} title="HTML 源码">
            <textarea
              id="md-html-input"
              value={htmlInput}
              onChange={(event) => setHtmlInput(event.target.value)}
              className="ui-textarea min-h-[300px]"
              spellCheck={false}
              aria-label="HTML 源码"
            />
            <Notice tone="info" className="mt-3">
              转换前会先净化 HTML（移除 script、事件属性与内联样式），再转成标准 Markdown；复杂布局可能被简化。
            </Notice>
          </Panel>
          <div className="mt-5">
            <OutputBlock
              label="转换后的 Markdown"
              hint="标题 ATX、代码块围栏、列表符号 -"
              value={resultMd}
              filename="converted.md"
              mimeType="text/markdown;charset=utf-8"
              minHeight="min-h-[240px]"
            />
          </div>
        </>
      )}

      {error && <Notice tone="error" className="mt-5">{error}</Notice>}

      <Notice tone="tip" className="mt-5">
        预览与转换全部在本机完成：HTML 经 DOMPurify 净化后渲染，默认不执行文档里内嵌的 HTML。打印按钮会调用浏览器打印，选择「另存为 PDF」即可导出。
      </Notice>
    </ToolShell>
  );
}
