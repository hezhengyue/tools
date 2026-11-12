<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 工作目录约定

本项目以**仓库根目录（即当前工作空间）为唯一工作目录**。所有文件读写、构建与命令执行都必须在这个目录原位进行。

- 禁止把项目复制/克隆到临时目录、默认目录或任何"工作副本"后再修改。
- 禁止在仓库外生成同名副本、影子目录或平行工程。
- 生成产物、临时脚本、调试文件一律放在已被 `.gitignore` 忽略的目录内，提交前确认 `git status`。

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
