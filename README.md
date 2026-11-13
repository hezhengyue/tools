# 正月工具箱

一个基于 Next.js App Router 的纯前端在线工具站：26 个常用工具，界面统一、无需后端、大部分计算都在浏览器本地完成。

## 技术栈

- Next.js 16（App Router）+ React 19 + TypeScript
- Tailwind CSS v4（`@import "tailwindcss"` + `@layer components`）
- `lucide-react` 图标；Web Worker 用于 RSA 密钥、证书、正则匹配、文件哈希与文本 diff 等重计算
- `qrcode` + `jsQR` 负责二维码生成与识别，`crypto-js` 按子路径引入做哈希

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
  app/                  # 首页 + 26 个工具页 + /api/my-ip 服务端路由
    api/my-ip/route.ts  # 全站唯一的服务端接口：查询公网 IP 归属地
    globals.css         # .ui-* 设计令牌（唯一视觉来源）
  components/
    ToolShell.tsx       # 所有工具页的统一外壳（标题 / 内容卡 / 页脚）
    Sidebar.tsx         # 桌面侧栏（含工具搜索）
    MobileHeader.tsx    # 移动端顶栏与抽屉
    ui/ToolUI.tsx       # Panel / Button / Notice / OutputBlock 等模板组件
  config/
    tools.ts            # 工具清单（名称、图标、描述、页脚说明）
    site.ts             # 站点名称与描述
```

新增工具页时请遵循 `AGENTS.md` 的「界面模板规范」：用 `ToolShell` 包裹、复用 `ToolUI` 模板组件、在 `tools.ts` 注册并填写结构化 `footer`。

## 数据与隐私

- 除「IP 地理位置」外，所有工具都在浏览器本地运行，不上传任何数据。
- 「IP 地理位置」由服务端 `/api/my-ip` 查询：优先使用平台注入的地理位置头，否则查公共 IP 库（`ipwho.is`，备用 `ipapi.co`）。仅向第三方发送公网 IP，不收集或存储个人信息。
- 图片压缩会强制重绘画布以清除 EXIF（GPS、设备型号、拍摄时间等）。

## 部署

纯 Next.js 应用，可部署到任意支持 Node.js 运行时的平台（Vercel、EdgeOne Pages、自有服务器等）。`/api/my-ip` 是动态路由，响应带 `Cache-Control: no-store`；不依赖任何 CDN 私有请求头。代码推送到 `main` 后需等待平台重新构建才会生效。

## 提交约定

见 `AGENTS.md`。要点：提交前检查 `git status`、只 `git add <具体文件>`；`.githooks/pre-commit` 会拦截构建产物、环境变量、密钥证书、白名单外的 Markdown，并对暂存的 TS/TSX 执行 ESLint。首次 clone 后需运行：

```bash
git config core.hooksPath .githooks
```
