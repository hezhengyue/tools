<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 工作目录约定

本项目以**仓库根目录（即当前工作空间）为唯一工作目录**。所有文件读写、构建与命令执行都必须在这个目录原位进行。

- 禁止把项目复制/克隆到临时目录、默认目录或任何"工作副本"后再修改。
- 禁止在仓库外生成同名副本、影子目录或平行工程。
- 生成产物、临时脚本、调试文件一律放在已被 `.gitignore` 忽略的目录内，提交前确认 `git status`。

# 界面模板规范

全站界面只有一套模板，**新增或修改工具页时必须复用，不要再写自己的配色/圆角/边框/按钮样式**。

唯一视觉来源：
- `src/app/globals.css` → `@layer components` 里的 `.ui-*` 语义类（设计令牌）。
- `src/components/ui/ToolUI.tsx` → 结构组件：`Panel` / `KeyRow` / `DisplayBox` / `Button` / `IconButton` / `Notice` / `EmptyState` / `Field` / `ToolActions` / `Badge`。
- `src/components/ToolShell.tsx` → 所有工具页统一外壳（标题、图标、描述、内容卡、页脚）。13 个页面全部用它包裹。

新工具页骨架：
```tsx
"use client";
import ToolShell from "@/components/ToolShell";
import { Panel, KeyRow, Button, Notice, ToolActions } from "@/components/ui/ToolUI";
import { SomeIcon } from "lucide-react";

export default function XxxPage() {
  return (
    <ToolShell>
      <Panel icon={SomeIcon} title="区块标题">
        <div className="ui-kv-list">
          <KeyRow label="名称" value="值" />
        </div>
      </Panel>
      <Notice tone="tip">提示内容</Notice>
      <ToolActions>
        <Button variant="secondary">次要操作</Button>
        <Button>主操作</Button>
      </ToolActions>
    </ToolShell>
  );
}
```
然后在 `src/config/tools.ts` 注册工具（名称、图标、描述、分类）并填 `footer`。

设计约定：主色 `indigo-600`；成功 `emerald`；提示 `amber`；错误 `red`；卡片 `rounded-2xl`，按钮 `rounded-xl`，小控件 `rounded-lg`；边框统一 `border-slate-200`；次级底色 `bg-slate-50`。语义色（哈希算法标签、密码强度、增删高亮、私钥警示）可保留。

页脚说明是**结构化数据**，不是 HTML：
```ts
footer: { mode: "local", subject: "文本", extra: "补充说明（可选）" }
```
`mode: "local"` 生成「所有处理在浏览器本地完成，{subject}不会上传到任何服务器。」；`mode: "server"` 用于确实需要服务端查询的工具（目前仅 IP 地理位置），生成「归属地由服务端接口查询…」。ToolShell 统一渲染，**禁止 `dangerouslySetInnerHTML`、禁止页脚写自由 HTML、禁止在页面里自写 `<h1>` 重复标题**。

# 提交前检查

提交到 GitHub 前必须确认 `git status` 中没有 `node_modules/`、`.next/`、`.env*`、`*.key`、`*.pem`、`.workbuddy/` 等内容；只添加源码与必要配置。

# 自动提交到 GitHub

用户要求：**每次代码改动完成并验证通过后，自动提交并推送到 `origin main`，无需再等待确认**。

执行流程（每次改完代码都要走完）：
1. 验证：至少 `npx tsc --noEmit`；涉及构建或路由时再跑 `npm run build`。
2. `git status --short` 确认改动范围。
3. `git add <具体文件>`；禁止 `git add -A` / `git add .`。
4. `git commit -m "修复:xxx"`，中文短句，沿用仓库风格（修复 / 新增 / 更新）。
5. **单独执行** `git push origin main`。
6. 环境注意：本机 `git commit` 偶尔会返回退出码 1 并打印 `git status` 文本，但提交其实已经创建。因此**不要把 commit 和 push 用 `&&` 串成一条命令**；commit 后先用 `git status -sb` / `git log -1` 确认，再单独 push。
7. push 失败（网络、认证、非快进）时如实报告并停下，**不 force、不跳过 hook**，也不要丢弃本地改动。

防呆：`.githooks/pre-commit` 会检查暂存区，拦截构建产物、环境变量、密钥证书、AI 工具数据，以及白名单以外的 `.md` 文件。首次克隆后执行 `git config core.hooksPath .githooks` 启用。
