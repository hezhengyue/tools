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
 * 页脚说明（可选，结构化纯文本，不允许 HTML）。
 * 全站固定文案由 ToolShell 渲染，格式与措辞都不随工具变化：
 *   - 默认（local）：「所有处理均在浏览器本地完成，数据不会上传到服务器。」
 *   - mode = "server"：「归属地需由服务端接口查询，仅将你的公网 IP 发送给公共 IP 库…」
 * 工具**通常不需要填 footer**。只有两种情况才填：
 *   1) 确实需要服务端请求 → mode: "server"（目前仅 IP 地理位置）；
 *   2) 页面里没写、又必须让用户在底部看到的一条补充 → note。
 * 工具的其它介绍一律写在自己的页面里，不要塞进页脚（避免底部与页面内重复）。
 */
export interface ToolFooter {
  mode?: "local" | "server";
  /** 可选的补充一句，跟在固定隐私句后面；绝大多数工具留空 */
  note?: string;
}

export interface ToolItem {
  name: string;
  href: string;
  icon: React.ElementType;
  desc: string;
  /** 可选：仅服务端工具或确有必要的一句补充，其余一律不填 */
  footer?: ToolFooter;
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
        desc: "一键生成高强度、安全的随机密码，支持自定义长度。"
      },
      {
        name: "文本哈希计算",
        href: "/hash-text",
        icon: Hash,
        desc: "快速计算文本的 MD5/SHA-1/SHA-256 等哈希值，支持多种加密算法。"
      },
      {
        name: "文件哈希校验",
        href: "/file-hash",
        icon: Fingerprint,
        desc: "拖拽文件流式计算 MD5/SHA-1/SHA-256/SHA-512，粘贴官方哈希值自动比对，大文件不占内存。"
      },
      {
        name: "SSH 密钥生成",
        href: "/ssh-key",
        icon: KeyRound,
        desc: "浏览器本地生成 SSH 公钥/私钥对。"
      },
      {
        name: "自签证书生成",
        href: "/self-cert",
        icon: FileBadge,
        desc: "浏览器本地生成自签名 X.509 TLS 证书，自动识别域名/IP，支持 SAN 扩展，输出标准 PEM 格式证书与私钥。",
        footer: { note: "自签证书默认不受浏览器信任，生产环境建议使用权威 CA 签发的证书。" }
      },
      {
        name: "JWT 解析",
        href: "/jwt",
        icon: KeySquare,
        desc: "本地解码 JWT 的 Header / Payload / Signature，展示过期倒计时与标准声明，实时提示过期状态。",
        footer: { note: "只做 Base64URL 解码，不验证签名；请勿粘贴生产环境的真实 Token。" }
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
        desc: "校验并格式化 JSON，错误精确到行列，支持树形浏览、压缩与一键转 TypeScript 接口。"
      },
      {
        name: "JSON 转 YAML",
        href: "/json-yaml",
        icon: FileJson,
        desc: "将复杂的 JSON 数据快速转换为结构清晰的 YAML 格式。"
      },
      {
        name: "时间戳转换",
        href: "/timestamp",
        icon: Clock,
        desc: "Unix 时间戳与日期时间互转，自动识别秒/毫秒，同时给出本地时间、UTC、ISO 8601 与相对时间。"
      },
      {
        name: "Base64 编解码",
        href: "/base64",
        icon: Binary,
        desc: "文本与文件双模式 Base64 编解码，UTF-8 中文不乱码，支持 URL-safe 变体与 Data URL 前缀。"
      },
      {
        name: "UUID / 随机串",
        href: "/uuid",
        icon: IdCard,
        desc: "批量生成 UUID v4 / v7、NanoID 与自定义随机串，支持前缀、大小写、长度与字符集，附带去重统计。"
      },
      {
        name: "Cron 表达式生成器",
        href: "/cron",
        icon: CalendarClock,
        desc: "可视化配置分/时/日/月/周，中文语义解释与未来 5 次执行时间预览，附常用模板，也支持手填解析。"
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
        desc: "查看浏览器、系统、GPU、屏幕等设备信息，公网 IP 请用 IP 地理位置工具。"
      },
      {
        name: "IP 地理位置",
        href: "/ip-geo",
        icon: MapPin,
        desc: "查询当前公网 IP 及详细的国家、城市、经纬度、运营商等归属地信息。",
        // 唯一需要服务端查询的工具：如实说明，不套用「本地处理」的固定句
        footer: { mode: "server" }
      },
      {
        name: "IP 与子网计算",
        href: "/ip-subnet",
        icon: Network,
        desc: "IPv4 CIDR 计算：网络/广播地址、掩码、可用主机范围、二进制视图、子网划分与 IP 整数互转。"
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
        desc: "实时对比两段文本的差异，支持按行/词/字符三种模式，高亮显示增删内容。"
      },
      {
        name: "正则测试器",
        href: "/regex",
        icon: Regex,
        desc: "实时匹配高亮、分组捕获、替换预览与常用表达式速查；独立线程运行，卡住自动终止。"
      },
      {
        name: "文本工具箱",
        href: "/text-tools",
        icon: FileText,
        desc: "URL / HTML / Unicode / Base64 / 十六进制编解码，大小写与命名风格、全半角、行去重排序、字数统计，39 种转换一页搞定。"
      },
      {
        name: "Markdown 预览与互转",
        href: "/markdown",
        icon: FileCode2,
        desc: "双栏实时预览、文档大纲、GFM 表格与任务列表；导出 HTML / 打印 PDF，并支持 HTML 反向转 Markdown。"
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
        desc: "必选清除隐私 + 可选压缩转格式，体积减少 40%~70%，纯前端处理。"
      },
      {
        name: "背景虚化",
        href: "/image-background-blur",
        icon: Sparkles,
        desc: "涂抹主体自动虚化背景，模拟单反景深效果，纯前端零延迟。"
      },
      {
        name: "图片转 Base64",
        href: "/image-to-base64",
        icon: FileCode,
        desc: "一键将图片转换为 Base64 字符串，支持内联到 HTML/CSS 中，纯前端处理。"
      },
      {
        name: "图片工具套件",
        href: "/image-tools",
        icon: ImagePlus,
        desc: "文字水印、圆角裁剪、九宫格切图、ICO / favicon 生成、SVG 转 PNG，五个功能一页切换，结果可直接下载。"
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
        desc: "按快捷键或点一下，直接拖动框选屏幕/窗口的任意区域，松开即完成并自动复制到剪贴板。"
      },
      {
        name: "在线录屏",
        href: "/screen-record",
        icon: ScreenShare,
        desc: "无需插件录制屏幕、窗口或标签页，可混入系统声音与麦克风，支持暂停续录，直接下载 WebM。"
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
        desc: "生成文本 / WiFi / 名片二维码，可调容错、配色与中心 Logo；支持批量、上传图片或摄像头识别。"
      },
      {
        name: "颜色与取色器",
        href: "/color",
        icon: Palette,
        desc: "HEX / RGB / HSL / CMYK 互转、屏幕吸色、WCAG 对比度检测、配色方案与图片主色调提取。"
      },
      {
        name: "单位与进制换算",
        href: "/unit-converter",
        icon: Ruler,
        desc: "长度、重量、温度、面积、体积、时间、数据、速度、压强九类单位换算，外加任意 2~36 进制互转（含小数）。"
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
        desc: "经典扫雷，首点必安全；三档难度、右键插旗、点击数字快速展开，支持触屏标记模式。"
      },
      {
        name: "2048",
        href: "/game-2048",
        icon: Grid2x2,
        desc: "方向键或滑动合并同值数字，目标合成 2048；支持撤销一步，最高分自动记录。"
      },
      {
        name: "贪吃蛇",
        href: "/snake",
        icon: Worm,
        desc: "经典贪吃蛇，电脑用方向键、手机滑动或点屏幕方向键；三档速度，最高分自动记录。"
      },
      {
        name: "五子棋",
        href: "/gomoku",
        icon: CircleDot,
        desc: "15 路棋盘，人机三档难度或同屏双人轮流；自动判五连、最后一手标记、支持悔棋。"
      },
    ]
  },
];
