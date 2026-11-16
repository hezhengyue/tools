# 正月工具箱

一个基于 Next.js App Router 的纯前端在线工具站：36 个常用工具，界面统一；35 个工具在浏览器本地完成计算，IP 地理位置由服务端接口查询归属地（见 `/api/my-ip`）。

## 技术栈

- Next.js 16（App Router）+ React 19 + TypeScript
- Tailwind CSS v4（`@import "tailwindcss"` + `@layer components`）
- `lucide-react` 图标；Web Worker 用于 RSA 密钥、证书、正则匹配、文件哈希与文本 diff 等重计算
- `qrcode` + `jsQR` 负责二维码生成与识别，`crypto-js` 按子路径引入做常规哈希；标准 SHA3-256 / SHA3-512 用 `@noble/hashes`（`crypto-js/sha3` 实为 Keccak，页面里单独标为 Keccak-512）
- `marked` + `DOMPurify` + `turndown` 负责 Markdown 渲染与 HTML 互转，`jszip` 用于图片切图 / 图标套件打包

## 本地运行

```bash
npm install
npm run dev
```

打开 <http://localhost:3000>。其他命令：

```bash
npm run build   # 生产构建
npm run start   # 启动生产服务
npm run lint    # ESLint 检查（提交前会自动执行）
npx tsc --noEmit # 类型检查
```

## 项目结构

```
src/
  app/                  # 首页 + 36 个工具页 + /api/my-ip 服务端路由
    <工具名>/layout.tsx # 每页独立 metadata（页面是 "use client"，metadata 只能由 layout 导出）
    api/my-ip/route.ts  # 全站唯一的服务端接口：查询公网 IP 归属地
    globals.css         # .ui-* 设计令牌、深色模式变量覆盖（唯一视觉来源）
  components/
    ToolShell.tsx       # 所有工具页的统一外壳（标题 / 收藏星标 / 内容卡 / 页脚）
    Sidebar.tsx         # 桌面侧栏（命令面板入口、收藏、外观切换）
    MobileHeader.tsx    # 移动端顶栏与抽屉
    CommandPalette.tsx  # Ctrl/⌘+K 全局命令面板
    PreferencesProvider.tsx # 主题 / 收藏 / 最近使用的 localStorage 状态
    ThemeToggle.tsx     # 浅色 / 深色 / 跟随系统三态切换
    PwaRegister.tsx     # 生产环境注册 Service Worker、离线提示
    RecentBar.tsx       # 首页「继续上次」
    ui/ToolUI.tsx       # Panel / Button / Notice / OutputBlock 等模板组件
  config/
    tools.ts            # 工具清单（名称、图标、描述、页脚说明）——全站唯一数据源
    search.ts           # 命令面板检索索引与别名
    metadata.ts         # 每页 metadata 生成
    site.ts             # 站点名称、描述、部署地址
public/
  manifest.webmanifest / sw.js / offline.html
  icon-*.png / og.jpg  # PWA 图标与分享图
```

新增工具页时请遵循 `AGENTS.md` 的「界面模板规范」：用 `ToolShell` 包裹、复用 `ToolUI` 模板组件、在 `tools.ts` 注册并填写结构化 `footer`，并复制一份同目录 `layout.tsx` 承载 metadata。检索索引、侧栏、命令面板都会自动收录，无需额外注册。

## 站点级能力

- **全局搜索**：`Ctrl/⌘ + K` 或点侧栏 / 移动端顶栏的搜索入口，支持名称、描述、分类与英文别名，↑↓ 选择、Enter 直达。
- **收藏与最近使用**：工具页标题右侧星标收藏，侧栏置顶「最近使用 / 我的收藏」，首页显示「继续上次」；数据只存 `localStorage`。
- **深色模式**：侧栏底部或移动端顶栏切换浅色 / 深色 / 跟随系统；首屏由内联脚本预设主题，不会闪白。
- **PWA 离线**：`manifest.webmanifest` + `sw.js`，页面导航 network-first、静态资源 cache-first，已访问过的工具断网可用；未缓存页面回退 `offline.html`。
- **SEO**：每个工具页有独立 title / description / Open Graph；根 layout 统一 title 模板与站点级 OG 图。

## 环境变量

部署时建议配置：

```bash
NEXT_PUBLIC_SITE_URL=https://你的域名
```

配置后才会输出 canonical 与 Open Graph 的绝对地址（含 `/og.jpg`）；未配置时不会把 `localhost` 写进公开页面。除此之外无必需环境变量。

## 数据与隐私

- 除「IP 地理位置」外，所有工具都在浏览器本地运行，不上传任何数据。
- 「IP 地理位置」由服务端 `/api/my-ip` 查询：优先使用平台注入的地理位置头，否则查公共 IP 库（`ipwho.is`，备用 `ipapi.co`）。仅向第三方发送公网 IP，不收集或存储个人信息。
- 图片压缩会强制重绘画布以清除 EXIF（GPS、设备型号、拍摄时间等）。

## 部署

纯 Next.js 应用，可部署到任意支持 Node.js 运行时的平台（Vercel、EdgeOne Pages、自有服务器等）。**当前生产环境是 EdgeOne Pages**。`/api/my-ip` 是动态路由，响应带 `Cache-Control: no-store`；不依赖任何 CDN 私有请求头。代码推送到 `main` 后需等待平台重新构建才会生效。

在 EdgeOne Pages 上，`/_next/static/` 下的 Web Worker 分包曾出现「页面正常、Worker 建得出来但消息永不返回」的情况（文件哈希一直停在 0%、自签证书一直等到超时）。因此 **`/file-hash`、`/ssh-key`、`/self-cert` 已改为纯主线程实现，不再使用 Worker**：文件哈希用 1MB 分块 + 每块让出主线程保持响应；RSA 走 WebCrypto（异步、不阻塞），只有在没有 `crypto.subtle` 的环境才退回 forge 同步实现并明确提示会变慢。新增功能如果要用 Worker，必须同时提供主线程兜底，不要假设线程一定可用。

Service Worker 只在生产环境且非 localhost 时注册，并要求 HTTPS（或 localhost）。若修改了 `public/sw.js` 的缓存策略，请同步提升 `CACHE_NAME` 版本号，否则老用户不会淘汰旧缓存。

## 提交约定

见 `AGENTS.md`。要点：提交前检查 `git status`、只 `git add <具体文件>`；`.githooks/pre-commit` 会拦截构建产物、环境变量、密钥证书、白名单外的 Markdown，并对暂存的 TS/TSX 执行 ESLint。首次 clone 后需运行：

```bash
git config core.hooksPath .githooks
```
