// config/tools.ts
import {
  Key, FileJson, Shield, Code,
  Hash, KeyRound, FileBadge, FileDiff, Type, Gamepad,
  Image, FileImage, Sparkles, Globe, MonitorSmartphone, MapPin, FileCode,
  Camera, ScreenShare, Video, Braces, Clock, Binary,
  Bomb, Grid2x2, Worm, CircleDot,
  Regex, QrCode, Fingerprint, KeySquare, Palette, IdCard, Shapes,
  FileText, FileCode2, CalendarClock, ImagePlus, Network, Ruler
} from "lucide-react";

/**
 * 页脚说明**不在这里配置**：文案由 ToolShell 统一渲染，全站固定、不可自定义。
 * 唯一区别是「是否需要服务端请求」——那份名单写在 ToolShell.tsx 的
 * SERVER_ROUTES 里（目前只有 /ip-geo），工具清单不再参与。
 * 工具的用法、限制、安全提醒一律写在页面里，不要指望页脚。
 */

/**
 * 内容宽度档位：决定工具页内容区的宽度，**与屏幕分辨率无关**。
 * 屏幕只决定容器能有多宽，不决定控件该有多大。
 *
 * 只有三档，**默认窄**。写新工具前必须先按顺序问这三句，命中即停：
 *
 *   1) 需要左右并排对照吗？（输入输出同时看、双栏编辑、图片/棋盘画布）
 *        是 → "full"（不限宽）
 *   2) 结果是多行条目、键值清单或参数表，要逐行比较吗？
 *        是 → "medium"（1040px）
 *   3) 都不是（单列输入、一个结果、单值换算、棋盘）
 *        → "narrow"（740px，默认档，不写就是这个）
 *
 * 拿不准就选窄一档：窄了只是两侧留白，宽了会散掉。窄改宽只换一个词，
 * 宽改窄要重排内部。
 *
 * **禁止**写具体宽度、**禁止**在页面里写 max-w-*；宽度由 globals.css 的
 * --ui-layout-* 统一控制，页面不参与决策。
 */
export type ToolLayout = "narrow" | "medium" | "full";

export interface ToolItem {
  name: string;
  href: string;
  icon: React.ElementType;
  desc: string;
  /** 宽度档位；默认 "narrow"，写工具时必须按上面的三问显式分配 */
  layout?: ToolLayout;
}

export interface ToolCategory {
  category: string;
  icon: React.ElementType;
  tools: ToolItem[];
}

export const toolsConfig: ToolCategory[] = [
  {
    category: "安全与加密",
    icon: Shield,
    tools: [
      {
        name: "强密码生成",
        href: "/password",
        icon: Key,
        desc: "一键生成高强度、安全的随机密码，支持自定义长度。",
        layout: "narrow"
      },
      {
        name: "文本哈希计算",
        href: "/hash-text",
        icon: Hash,
        desc: "快速计算文本的 MD5/SHA-1/SHA-256 等哈希值，支持多种加密算法。",
        layout: "medium"
      },
      {
        name: "文件哈希校验",
        href: "/file-hash",
        icon: Fingerprint,
        desc: "拖拽文件流式计算 MD5/SHA-1/SHA-256/SHA-512，粘贴官方哈希值自动比对，大文件不占内存。",
        layout: "medium"
      },
      {
        name: "SSH 密钥生成",
        href: "/ssh-key",
        icon: KeyRound,
        desc: "浏览器本地生成 SSH 公钥/私钥对。",
        layout: "medium"
      },
      {
        name: "自签证书生成",
        href: "/self-cert",
        icon: FileBadge,
        desc: "浏览器本地生成自签名 X.509 TLS 证书，自动识别域名/IP，支持 SAN 扩展，输出标准 PEM 格式证书与私钥。",
        layout: "medium"
      },
      {
        name: "JWT 解析",
        href: "/jwt",
        icon: KeySquare,
        desc: "本地解码 JWT 的 Header / Payload / Signature，展示过期倒计时与标准声明，实时提示过期状态。",
        layout: "medium"
      },
    ]
  },
  {
    category: "开发与转换",
    icon: Code,
    tools: [
      {
        name: "JSON 格式化",
        href: "/json-format",
        icon: Braces,
        desc: "校验并格式化 JSON，错误精确到行列，支持树形浏览、压缩与一键转 TypeScript 接口。",
        layout: "full"
      },
      {
        name: "JSON ⇄ YAML",
        href: "/json-yaml",
        icon: FileJson,
        desc: "JSON 与 YAML 双向互转：粘贴任意一侧自动转换，还能一键反向把 YAML 转回 JSON。",
        layout: "full"
      },
      {
        name: "时间戳转换",
        href: "/timestamp",
        icon: Clock,
        desc: "Unix 时间戳与日期时间互转，自动识别秒/毫秒，同时给出本地时间、UTC、ISO 8601 与相对时间。",
        layout: "narrow"
      },
      {
        name: "Base64 编解码",
        href: "/base64",
        icon: Binary,
        desc: "文本与文件双模式 Base64 编解码，UTF-8 中文不乱码，支持 URL-safe 变体与 Data URL 前缀。",
        layout: "full"
      },
      {
        name: "UUID / 随机串",
        href: "/uuid",
        icon: IdCard,
        desc: "批量生成 UUID v4 / v7、NanoID 与自定义随机串，支持前缀、大小写、长度与字符集，附带去重统计。",
        layout: "medium"
      },
      {
        name: "Cron 表达式生成器",
        href: "/cron",
        icon: CalendarClock,
        desc: "可视化配置分/时/日/月/周，中文语义解释与未来 5 次执行时间预览，附常用模板，也支持手填解析。",
        layout: "medium"
      },
    ]
  },
  {
    category: "网络工具",
    icon: Globe,
    tools: [
      {
        name: "设备检测",
        href: "/device-info",
        icon: MonitorSmartphone,
        desc: "查看浏览器、系统、GPU、屏幕等设备信息，公网 IP 请用 IP 地理位置工具。",
        layout: "medium"
      },
      {
        name: "IP 地理位置",
        href: "/ip-geo",
        icon: MapPin,
        desc: "查询当前公网 IP 及详细的国家、城市、经纬度、运营商等归属地信息。",
        layout: "narrow"
      },
      {
        name: "IP 与子网计算",
        href: "/ip-subnet",
        icon: Network,
        desc: "IPv4 CIDR 计算：网络/广播地址、掩码、可用主机范围、二进制视图、子网划分与 IP 整数互转。",
        layout: "medium"
      }
    ]
  },
  {
    category: "文本处理",
    icon: Type,
    tools: [
      {
        name: "文本对比",
        href: "/text-diff",
        icon: FileDiff,
        desc: "实时对比两段文本的差异，支持按行/词/字符三种模式，高亮显示增删内容。",
        layout: "full"
      },
      {
        name: "正则测试器",
        href: "/regex",
        icon: Regex,
        desc: "实时匹配高亮、分组捕获、替换预览与常用表达式速查；独立线程运行，卡住自动终止。",
        layout: "medium"
      },
      {
        name: "文本工具箱",
        href: "/text-tools",
        icon: FileText,
        desc: "URL / HTML / Unicode / Base64 / 十六进制编解码，大小写与命名风格、全半角、行去重排序、字数统计，39 种转换一页搞定。",
        layout: "full"
      },
      {
        name: "Markdown 预览与互转",
        href: "/markdown",
        icon: FileCode2,
        desc: "双栏实时预览、文档大纲、GFM 表格与任务列表；导出 HTML / 打印 PDF，并支持 HTML 反向转 Markdown。",
        layout: "full"
      },
    ]
  },
  {
    category: "图片工具",
    icon: Image,
    tools: [
      {
        name: "图片预处理",
        href: "/image-compress",
        icon: FileImage,
        desc: "清除隐私信息 + 可选压缩转 WebP/AVIF，体积减少约一半，支持批量。",
        layout: "full"
      },
      {
        name: "背景虚化",
        href: "/image-background-blur",
        icon: Sparkles,
        desc: "涂抹主体后自动虚化背景，模拟单反景深效果。",
        layout: "full"
      },
      {
        name: "图片转 Base64",
        href: "/image-to-base64",
        icon: FileCode,
        desc: "一键把图片转成 Base64 字符串，方便内联到 HTML / CSS。",
        layout: "full"
      },
      {
        name: "图片工具套件",
        href: "/image-tools",
        icon: ImagePlus,
        desc: "文字水印、圆角裁剪、九宫格切图、ICO / favicon 生成、SVG 转 PNG，五个功能一页切换，结果可直接下载。",
        layout: "full"
      },
    ]
  },
  {
    category: "媒体工具",
    icon: Video,
    tools: [
      {
        name: "在线截图",
        href: "/screenshot",
        icon: Camera,
        desc: "先选屏幕/窗口，画面冻结后拖框选择区域，也可直接保存整张，结果可复制或下载 PNG。",
        layout: "full"
      },
      {
        name: "在线录屏",
        href: "/screen-record",
        icon: ScreenShare,
        desc: "无需插件录制屏幕、窗口或标签页，可混入系统声音与麦克风，支持暂停续录，直接下载 WebM。",
        layout: "full"
      },
    ]
  },
  {
    category: "实用工具",
    icon: Shapes,
    tools: [
      {
        name: "二维码生成 / 识别",
        href: "/qrcode",
        icon: QrCode,
        desc: "生成文本 / WiFi / 名片二维码，可调容错、配色与中心 Logo；支持批量、上传图片或摄像头识别。",
        layout: "full"
      },
      {
        name: "颜色与取色器",
        href: "/color",
        icon: Palette,
        desc: "HEX / RGB / HSL / CMYK 互转、屏幕吸色、WCAG 对比度检测、配色方案与图片主色调提取。",
        layout: "full"
      },
      {
        name: "单位与进制换算",
        href: "/unit-converter",
        icon: Ruler,
        desc: "长度、重量、温度、面积、体积、时间、数据、速度、压强九类单位换算，外加任意 2~36 进制互转（含小数）。",
        layout: "narrow"
      },
    ]
  },
  {
    category: "游戏",
    icon: Gamepad,
    tools: [
      {
        name: "扫雷",
        href: "/minesweeper",
        icon: Bomb,
        desc: "经典扫雷，首点必安全；三档难度、右键插旗、点击数字快速展开，支持触屏标记模式。",
        layout: "narrow"
      },
      {
        name: "2048",
        href: "/game-2048",
        icon: Grid2x2,
        desc: "方向键或滑动合并同值数字，目标合成 2048；支持撤销一步，最高分自动记录。",
        layout: "narrow"
      },
      {
        name: "贪吃蛇",
        href: "/snake",
        icon: Worm,
        desc: "经典贪吃蛇，电脑用方向键、手机滑动或点屏幕方向键；三档速度，最高分自动记录。",
        layout: "narrow"
      },
      {
        name: "五子棋",
        href: "/gomoku",
        icon: CircleDot,
        desc: "15 路棋盘，人机三档难度或同屏双人轮流；自动判五连、最后一手标记、支持悔棋。",
        layout: "narrow"
      },
    ]
  },
];
