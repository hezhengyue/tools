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
- `src/components/ui/ToolUI.tsx` → 结构组件：`Panel` / `KeyRow` / `DisplayBox` / `Button` / `IconButton` / `Notice` / `EmptyState` / `Field` / `ToolActions` / `Badge`，以及输出块 `OutputBlock` / `CopyButton` / `DownloadButton` 与剪贴板工具 `writeClipboard`。
- `src/config/site.ts` → 站点名称与描述的唯一来源（metadata / 侧栏 / 移动端顶栏共用）。
- `src/components/ToolShell.tsx` → 所有工具页统一外壳（标题、图标、描述、内容卡、页脚）。全部工具页都用它包裹。

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

## 输出块：复制 / 下载统一交互（强制）

凡是「一段文本结果 + 复制 / 下载」，一律用 `OutputBlock`：**标题行**左侧是标签，右侧是复制 / 下载图标按钮，下方直接展示内容。标杆页面 `src/app/ssh-key/page.tsx` 与 `src/app/self-cert/page.tsx`。

```tsx
<OutputBlock
  label="private-key.pem"
  hint="请妥善保管，遗失不可恢复"
  tone="warning"              // 私钥等敏感内容用琥珀色
  value={privateKey}
  filename="private-key.pem"  // 传了才出现下载按钮
  copyLabel="复制私钥"
  minHeight="min-h-[250px]"
/>
```

- `children` 可自定义内容区（如代码块），复制仍取 `value`；复制/下载按钮在 `value` 为空时自动禁用。
- 只需单个动作用 `CopyButton`（自带「已复制」成功态）或 `DownloadButton`，**不要在页面里再写 `navigator.clipboard` / `Blob` 下载逻辑**。
- 禁止：把复制/下载做成结果下方一排大按钮、用 `<details>` 折叠藏结果、每个输出块各写一套按钮样式。
- 例外：整页级主操作按钮组（如「复制全部 / 重新检测」）与图片 / 画板文件导出不属于文本输出块，继续用 `Button` / `ToolActions`。

设计约定：主色 `indigo-600`；成功 `emerald`；提示 `amber`；错误 `red`；卡片 `rounded-2xl`，按钮 `rounded-xl`，小控件 `rounded-lg`；边框统一 `border-slate-200`；次级底色 `bg-slate-50`。语义色（哈希算法标签、密码强度、增删高亮、私钥警示）可保留。

页脚说明是**结构化数据**，不是 HTML：
```ts
footer: { mode: "local", subject: "文本", extra: "补充说明（可选）" }
```
`mode: "local"` 生成「所有处理在浏览器本地完成，{subject}不会上传到任何服务器。」；`mode: "server"` 用于确实需要服务端查询的工具（目前仅 IP 地理位置），生成「归属地由服务端接口查询…」。ToolShell 统一渲染，**禁止 `dangerouslySetInnerHTML`、禁止页脚写自由 HTML、禁止在页面里自写 `<h1>` 重复标题**。

# 工程与质量约定

- **验证基线**：`npx tsc --noEmit`、`npm run lint` 都必须零错误；涉及路由/构建时再跑 `npm run build`。pre-commit 钩子会对暂存的 TS/TSX 自动执行 ESLint，未通过无法提交。
- **依赖**：只保留实际 import 的包；`crypto-js` 一律用子路径（如 `crypto-js/sha256`）按需引入，不要从主入口全量导入。
- **随机与密码**：需要安全随机一律用 `crypto.getRandomValues`，禁止 `Math.random()` 生成密码；洗牌用 Fisher-Yates；抽奖等非安全场景也统一走模块级 `shuffle()`。
- **剪贴板**：统一用 `writeClipboard()`（内置 `execCommand` 降级），禁止页面里直接 `navigator.clipboard.writeText` 或无条件弹「已复制」。
- **资源**：图片类页面必须校验文件大小与像素上限、等比缩小超大图；`createObjectURL` 在卸载/替换时 `revokeObjectURL`，`ImageBitmap` 用完 `close()`，所有 `setTimeout` 在卸载时清理；高频绘制用 `requestAnimationFrame` 合并。
- **可访问性**：允许用户缩放（viewport 不设 `userScalable: false`）；独立 `<label>` 必须用 `htmlFor` 关联控件 id；图标按钮必须有 `aria-label`；上传区支持键盘触发；动态提示用 `Notice`（自带 `role=status/alert`）；小字最低 `text-slate-500`，不要用 `text-slate-400`。
- **隐私**：新增工具默认在浏览器本地处理；若确实需要服务端请求，必须在 `tools.ts` 的 `footer.mode` 标为 `"server"` 并如实说明，不要套用「不会上传任何服务器」。
- **待办**：图片压缩与背景虚化的画布计算仍在主线程（已用像素上限 + 异步编码缓解），彻底 Worker 化需单独排期并做浏览器兼容验证。

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

防呆：`.githooks/pre-commit` 会检查暂存区（路径大小写不敏感），拦截构建产物、环境变量、密钥证书、AI 工具数据、疑似私钥/token 的新增行，以及白名单以外的 `.md` 文件，并对暂存的 TS/TSX 执行 ESLint。首次克隆后执行 `git config core.hooksPath .githooks` 启用。
