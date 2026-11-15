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
- `src/components/ToolShell.tsx` → 所有工具页统一外壳（面包屑、标题、图标、描述、收藏、内容卡、底部一行固定隐私说明）。全部工具页都用它包裹，面包屑的分类从 `tools.ts` 派生，页面不要自己写。
- 首页 / 导航组件：`HomeSearch`（搜索主入口）、`RecentBar`（最近 + 收藏快捷入口）、`HomeCategories`（可折叠分类）、`Sidebar`、`MobileHeader`（模态抽屉）、`CommandPalette`、`ShortcutHint`（Mac 显示 ⌘K）。

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
然后在 `src/config/tools.ts` 注册工具（名称、图标、描述、分类）。`footer` 默认不填；只有确实需要服务端请求的工具才填 `{ mode: "server" }`。

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
/>
```

- `children` 可自定义内容区（如代码块），复制仍取 `value`；复制/下载按钮在 `value` 为空时自动禁用。
- 只需单个动作用 `CopyButton`（自带「已复制」成功态）或 `DownloadButton`，**不要在页面里再写 `navigator.clipboard` / `Blob` 下载逻辑**。
- `OutputBlock` 没有 `minHeight` 参数，高度统一由 `.ui-output-min` 控制；页面不要自己指定高度，也不要新增类似的高度参数。
- 禁止：把复制/下载做成结果下方一排大按钮、用 `<details>` 折叠藏结果、每个输出块各写一套按钮样式。
- 例外：整页级主操作按钮组（如「复制全部 / 重新检测」）与图片文件导出不属于文本输出块，继续用 `Button` / `ToolActions`。

设计约定：主色 `indigo-600`；成功 `emerald`；提示 `amber`；错误 `red`；卡片 `rounded-2xl`，按钮 `rounded-xl`，小控件 `rounded-lg`；边框统一 `border-slate-200`；次级底色 `bg-slate-50`。语义色（哈希算法标签、密码强度、增删高亮、私钥警示）可保留。

## 页脚：一行固定隐私说明（强制）

底部说明由 `ToolShell` 的 `PrivacyLine` 统一渲染为 `.ui-privacy`（一小行灰字 + 上分隔线，不是卡片、不用警告图标）。**文案全站固定、不随工具变化**：

- 默认：「所有处理均在浏览器本地完成，数据不会上传到服务器。」
- `footer: { mode: "server" }`：「归属地需由服务端接口查询，仅将你的公网 IP 发送给公共 IP 库，不收集或存储个人信息。」（目前仅 IP 地理位置）

`tools.ts` 里的 `footer` **是可选的，绝大多数工具不要填**：

```ts
footer?: { mode?: "local" | "server"; note?: string }
```

`note` 只允许填「页面内部没写、又必须让用户在底部看到」的一条补充说明（如 JWT 不验签、自签证书不受信任），不要写工具介绍、用法、算法说明、限制说明——**这些一律写在工具自己的页面里**（`Notice` / `Field` / 说明文字），避免底部与页面内重复。页脚只允许纯文本结构化数据，**禁止 `dangerouslySetInnerHTML`、禁止自由 HTML、禁止在页面里自写 `<h1>` 或另写一份隐私说明**。

理由：以前每个工具都在底部拼一段「主句 + 自定义补充」，30 多页格式各异、和上方内容卡视觉冲突，还经常和页面内自带的介绍重复。现在底部只承担「声明数据流向」这一件事。

## 布局尺寸：唯一规则（强制）

**全站宽度只在 `src/app/globals.css` 定义**，由 `src/app/layout.tsx` 的主内容容器使用：`.ui-page { width: 100%; max-width: var(--ui-page-max); margin-inline: auto; }`。`--ui-page-max`（当前 **1440px**）是**唯一可调的数字**：视口比它窄时自然铺满，比它宽时居中留白，避免 2K / 4K 屏把内容拉得过大。整体要变宽 / 变窄只改这一个变量，不要逐页改、不要加档位。

  超宽屏可读性由组件级规则统一兜底，页面无需判断：说明文字用 `.ui-prose`（100ch），提示条 `.ui-notice` 自带 100ch 上限，单行输入 `.ui-input` / `.ui-select` 上限 48rem；编辑器、预览、表格、画布仍铺满可用宽度。首页卡片列数由 `.ui-card-grid`（auto-fill minmax）自动决定。

- **禁止**在工具页、`ToolShell`、任何组件里写页面级宽度类（`max-w-4xl` / `max-w-6xl` / `w-[calc(100%-18rem)]` 等），也不要在别处覆盖 `--ui-page-max`。新增页面只写内容，宽度自动继承，不需要也不允许做选择。
- 主编辑区统一用 `.ui-editor`，主预览区统一用 `.ui-viewer`，棋盘统一用 `.ui-board`（内含「不超过可视高度」保护，保证整盘完整可见）。**不要自己写 `min-h-[420px]` / `max-w-[520px]` 这类一次性数值**。
- **表单 / 选项字段组统一用 `.ui-form-grid`**（`auto-fit minmax(22rem, 1fr)`，列数随视口自动算）。不要写死 `grid grid-cols-2` / `sm:grid-cols-2`——那会让 2K / 4K 屏上只剩两列、每个输入被拉成一条。固定 2 列的按钮组、A/交换/B 三列输入、Markdown / Diff 双栏编辑区属于有语义的布局，保留原写法。
- 面包屑 `.ui-breadcrumb`、快捷键 `.ui-shortcut`、侧栏阴影 `.ui-sidebar` 也都在 `globals.css`，不要在组件里另写一套。
- 局部元素（文字截断、按钮组、小控件）仍可用 `max-w-[10rem]`，但不得用在页面或主内容容器上。
- 滚动区上限统一用视口相对值（`max-h-[70vh]` / `max-h-[calc(100vh_-_240px)]`），不要写死 `max-h-[400px]` 这类在 4K 屏上显得很小的数值。
- 需要「更大 / 显示更多」时**只改 `globals.css` 里的 `--ui-page-max` 与这几个语义类**，不要逐页改；首页卡片网格用 `.ui-card-grid`，不要写死断点列数。
- 理由：多档位、每页 `wide` 属性、可覆盖宽度，会让后续维护者（包括 AI）每建一页都要判断一次用哪档，必然出现不一致。唯一变量 + 唯一规则 = 零判断 = 不会写错。

# 站点级能力约定

- **单一数据源**：`src/config/tools.ts` 是工具清单的唯一来源。侧栏、首页、命令面板检索（`config/search.ts`）与每页 metadata（`config/metadata.ts`）都由它派生。新增工具只需注册清单，不要在多处维护名称列表；英文 / 缩写别名在 `search.ts` 的 `ALIASES` 里补。
- **metadata 的载体**：所有工具页都是 `"use client"`，Next.js 不允许客户端组件导出 `metadata`。因此每个工具目录下有一个极小的服务端 `layout.tsx`，只做 `export const metadata = toolMetadata("/xxx")` 并原样返回 `children`。新增工具页时复制一份即可；不要改成 `generateMetadata` + `headers()`，那会让全部路由转为动态渲染。
- **站点地址**：canonical 与 OG 绝对地址来自 `NEXT_PUBLIC_SITE_URL`（`config/site.ts`）。未配置时**不输出**绝对 URL，避免 localhost 泄漏到线上。
- **主题 / 偏好**：`PreferencesProvider` 管理 `tools.theme`、`tools.favorites`、`tools.recent`、`tools.collapsedCategories` 四个 localStorage key；`layout.tsx` 里的内联 `THEME_INIT` 与 Provider 的 `applyTheme` 判断必须保持一致。新增偏好一律走 Provider（含首帧不读存储、多标签同步），不要在组件里直接碰 localStorage。
- **深色模式**：靠 `html.dark` 上重定义 Tailwind v4 的 `--color-*` 变量实现。Tailwind v4 把纯色类编译为 `var(--color-xxx)`、透明度类编译为 `color-mix(... var(--color-xxx) ...)`，**两者都会自动跟随变量**。因此「不要在新页面里写死 `#fff` / 固定浅色底」，也**禁止再按 `[class*="bg-xxx/"]` 逐类兜底**（会漏掉新类并覆盖正确透明度）。只有三类例外允许覆盖：`text-white`、主按钮 `bg-indigo-600/700`、黑底视频容器 `bg-slate-900`。
- **分类折叠**：侧栏与首页共用 `useCategoryExpansion(scope, defaults)`（在 `PreferencesProvider.tsx` 导出）。视图只传 scope（`"sidebar"` / `"home"`）和「默认展开哪些分类」（侧栏 = 当前工具所属分类，首页 = 全部分类），不要自己读写折叠状态、不要另建 state。两个 scope 的状态**按视图隔离**，否则「侧栏只展开当前分类」会把首页也折掉；读写仍只有这一个 hook 与 `tools.collapsedCategories` 一个 key。
- **命令面板 / 抽屉**：任何组件都可以调用 `openCommandPalette()` 打开；全局快捷键与 `tools:open-search` 事件由 `CommandPalette.tsx` 统一监听，平台快捷键文案统一用 `ShortcutHint`。`MobileHeader` 的移动端抽屉是模态对话框：点链接自动关闭（事件委托，新增链接无需再改）、Esc 关闭、Tab 焦点循环、关闭后焦点回到菜单按钮、打开时锁定主区滚动。改抽屉时这些行为都要保留。
- **PWA**：`public/sw.js` 的导航请求是 network-first（在线永远拿最新版），`/_next/static/` 带内容哈希走 cache-first，**无哈希的图标 / manifest / CSS 也必须 network-first**（否则老用户在线也永远看旧文件），RSC 与 `/api/` 及未匹配动态请求完全不缓存。修改缓存策略或替换 public 静态资源必须提升 `CACHE_NAME`。`PwaRegister.tsx` 只在生产 + 非 localhost 注册，避免本地验证被缓存干扰。

# 工程与质量约定

- **验证基线**：`npx tsc --noEmit`、`npm run lint` 都必须零错误；涉及路由/构建时再跑 `npm run build`。pre-commit 钩子会对暂存的 TS/TSX 自动执行 ESLint，未通过无法提交。
- **依赖**：只保留实际 import 的包；`crypto-js` 一律用子路径（如 `crypto-js/sha256`）按需引入，不要从主入口全量导入。
- **随机与密码**：需要安全随机一律用 `crypto.getRandomValues`，禁止 `Math.random()` 生成密码；洗牌用 Fisher-Yates；游戏、抽签这类非安全场景可以用 `Math.random()`，但必须发生在事件回调/effect 里，不能出现在渲染期（否则水合不一致，也会被 React Compiler 的 purity 规则拦下）。
- **剪贴板**：统一用 `writeClipboard()`（内置 `execCommand` 降级），禁止页面里直接 `navigator.clipboard.writeText` 或无条件弹「已复制」。
- **资源**：图片类页面必须校验文件大小与像素上限、等比缩小超大图；`createObjectURL` 在卸载/替换时 `revokeObjectURL`，`ImageBitmap` 用完 `close()`，所有 `setTimeout` 在卸载时清理；高频绘制用 `requestAnimationFrame` 合并。
- **解码炸弹（强制）**：任何 `new Image()` / `createImageBitmap()` / `<img src={dataUrl}>` 之前，必须先 `await checkImageFile(file)`（`src/lib/image-guard.ts`），它只读文件头拿原始尺寸并拒绝超大图。文件大小上限挡不住几百 KB 却能解码成上亿像素的高压缩 PNG。返回值非 null 时直接展示错误、不要继续解码。
- **异步任务防护**：Worker / 生成类任务一律带 `requestId`（worker 原样回传、页面丢弃非当前请求的迟到消息）、用同步 `ref` 防重入（不能只靠按钮 `disabled`）、开始时清空上一次结果、失败/超时也清空结果（尤其私钥/证书，避免用户误把旧结果当新的复制）。`fetch` 一律带 `AbortController` + 超时 + 卸载 abort；响应必须校验业务字段（`success`、`ip` 类型等），不能 `res.ok` 就当成功。
- **全局键盘监听**：挂在 `window` 上的游戏/快捷键监听，开头必须跳过 `INPUT` / `TEXTAREA` / `SELECT` / `contenteditable` 焦点和 `metaKey/ctrlKey/altKey`，否则命令面板打字会驱动游戏、空格会被吞掉。
- **游戏状态**：连续输入可能落在同一帧，棋盘/分数/撤销栈要放在同步更新的 `ref` 里（React state 只作渲染镜像），不要基于闭包中的旧 state 累加。
- **哈希算法**：`crypto-js/sha3` 用的是 Keccak padding(0x01)，**不是** NIST SHA-3；标准 `SHA3-256` / `SHA3-512` 必须用 `@noble/hashes/sha3.js`，旧实现单独标为 `Keccak-512`。别把两者混用。
- **JSON 精度**：`JSON.parse` 会静默舍入超过 `Number.MAX_SAFE_INTEGER` 的整数。转换类页面必须先扫描字面量并明确报错（json-yaml 的 `parseJsonLossless`），禁止给出「已转换」却改坏了 ID / 金额。
- **可访问性**：允许用户缩放（viewport 不设 `userScalable: false`）；独立 `<label>` 必须用 `htmlFor` 关联控件 id；图标按钮必须有 `aria-label`；上传区支持键盘触发；动态提示用 `Notice`（自带 `role=status/alert`）；小字最低 `text-slate-500`，不要用 `text-slate-400`。
- **隐私**：新增工具默认在浏览器本地处理；底部固定隐私句由 ToolShell 渲染，页面内不要再重复写「本地处理 / 不会上传」。若确实需要服务端请求，必须在 `tools.ts` 的 `footer.mode` 标为 `"server"` 并如实说明，不要套用「不会上传任何服务器」。
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
