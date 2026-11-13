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
 * 页脚说明（结构化，纯文本，不允许 HTML）。
 * ToolShell 会按统一模板渲染：
 *   [图标] 主句（含加粗关键词）。补充说明。
 * - mode = "local"  → 「所有处理在浏览器本地完成，{subject}不会上传到任何服务器。」
 * - mode = "server" → 「{subject}归属地需由服务端接口查询，仅使用你的公网 IP 发起请求。」
 * 这样所有工具页的页脚格式一致，同时能如实反映每个工具真实的数据流向。
 */
export interface ToolFooter {
  mode: "local" | "server";
  /** 处理对象，嵌入统一句式，如「文本」「图片」「公网 IP」 */
  subject: string;
  /** 补充说明，跟在主句之后；没有可不填 */
  extra?: string;
}

export interface ToolItem {
  name: string;
  href: string;
  icon: React.ElementType;
  desc: string;
  /** 底部说明：结构化数据，由 ToolShell 统一渲染 */
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
        desc: "一键生成高强度、安全的随机密码，支持自定义长度。",
        footer: { mode: "local", subject: "生成的密码" }
      },
      {
        name: "文本哈希计算",
        href: "/hash-text",
        icon: Hash,
        desc: "快速计算文本的 MD5/SHA-1/SHA-256 等哈希值，支持多种加密算法。",
        footer: {
          mode: "local",
          subject: "文本",
          extra: "哈希是单向函数，适合校验数据完整性，不可用于密码加密存储（请用 bcrypt/argon2）。"
        }
      },
      {
        name: "文件哈希校验",
        href: "/file-hash",
        icon: Fingerprint,
        desc: "拖拽文件流式计算 MD5/SHA-1/SHA-256/SHA-512，粘贴官方哈希值自动比对，大文件不占内存。",
        footer: {
          mode: "local",
          subject: "文件",
          extra: "分块读取、独立线程计算，内存占用恒定；MD5 与 SHA-1 仅适合完整性校验，不能作为安全凭证。"
        }
      },
      {
        name: "SSH 密钥生成",
        href: "/ssh-key",
        icon: KeyRound,
        desc: "浏览器本地生成 SSH 公钥/私钥对。",
        footer: {
          mode: "local",
          subject: "密钥",
          extra: "私钥请妥善保存，丢失无法恢复。"
        }
      },
      {
        name: "自签证书生成",
        href: "/self-cert",
        icon: FileBadge,
        desc: "浏览器本地生成自签名 X.509 TLS 证书，自动识别域名/IP，支持 SAN 扩展，输出标准 PEM 格式证书与私钥。",
        footer: {
          mode: "local",
          subject: "证书与私钥",
          extra: "自签证书默认不受浏览器信任，生产环境建议使用权威 CA 签发证书。"
        }
      },
      {
        name: "JWT 解析",
        href: "/jwt",
        icon: KeySquare,
        desc: "本地解码 JWT 的 Header / Payload / Signature，展示过期倒计时与标准声明，实时提示过期状态。",
        footer: {
          mode: "local",
          subject: "Token",
          extra: "只做 Base64URL 解码，不验证签名；生产环境的真实 token 等于登录凭证，请勿粘贴到任何在线工具。"
        }
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
        footer: {
          mode: "local",
          subject: "JSON 数据",
          extra: "错误提示会精确到行号与列号，处理过程不记录任何内容。"
        }
      },
      {
        name: "JSON 转 YAML",
        href: "/json-yaml",
        icon: FileJson,
        desc: "将复杂的 JSON 数据快速转换为结构清晰的 YAML 格式。",
        footer: {
          mode: "local",
          subject: "JSON 数据",
          extra: "输入后实时自动转换，无需点击按钮。"
        }
      },
      {
        name: "时间戳转换",
        href: "/timestamp",
        icon: Clock,
        desc: "Unix 时间戳与日期时间互转，自动识别秒/毫秒，同时给出本地时间、UTC、ISO 8601 与相对时间。",
        footer: {
          mode: "local",
          subject: "时间数据",
          extra: "按浏览器所在时区换算，不发起任何网络请求。"
        }
      },
      {
        name: "Base64 编解码",
        href: "/base64",
        icon: Binary,
        desc: "文本与文件双模式 Base64 编解码，UTF-8 中文不乱码，支持 URL-safe 变体与 Data URL 前缀。",
        footer: {
          mode: "local",
          subject: "文本与文件",
          extra: "Base64 只是编码不是加密，任何人都能还原，不要用它保存密码。"
        }
      },
      {
        name: "UUID / 随机串",
        href: "/uuid",
        icon: IdCard,
        desc: "批量生成 UUID v4 / v7、NanoID 与自定义随机串，支持前缀、大小写、长度与字符集，附带去重统计。",
        footer: {
          mode: "local",
          subject: "生成的 ID",
          extra: "随机源为浏览器密码学安全的 crypto.getRandomValues；最近 5 批记录只保存在本机浏览器。"
        }
      },
      {
        name: "Cron 表达式生成器",
        href: "/cron",
        icon: CalendarClock,
        desc: "可视化配置分/时/日/月/周，中文语义解释与未来 5 次执行时间预览，附常用模板，也支持手填解析。",
        footer: {
          mode: "local",
          subject: "表达式",
          extra: "采用标准 5 段 Linux cron 语法，执行时间按浏览器本地时区计算。"
        }
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
        desc: "查看当前公网IP、浏览器、系统、GPU、屏幕等信息。",
        footer: { mode: "local", subject: "设备信息" }
      },
      {
        name: "IP 地理位置",
        href: "/ip-geo",
        icon: MapPin,
        desc: "查询当前公网 IP 及详细的国家、城市、经纬度、运营商等归属地信息。",
        // 唯一需要服务端查询的工具：如实说明，不套用「不上传任何服务器」的本地句式
        footer: {
          mode: "server",
          subject: "公网 IP",
          extra: "查询过程不收集或存储个人信息；主备数据源自动切换，兼容各类部署环境。"
        }
      },
      {
        name: "IP 与子网计算",
        href: "/ip-subnet",
        icon: Network,
        desc: "IPv4 CIDR 计算：网络/广播地址、掩码、可用主机范围、二进制视图、子网划分与 IP 整数互转。",
        footer: {
          mode: "local",
          subject: "IP 地址",
          extra: "只做 IPv4 数值计算，页面里的地址是计算样本，不会查询你的真实公网 IP。"
        }
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
        footer: { mode: "local", subject: "文本" }
      },
      {
        name: "正则测试器",
        href: "/regex",
        icon: Regex,
        desc: "实时匹配高亮、分组捕获、替换预览与常用表达式速查；独立线程运行，卡住自动终止。",
        footer: {
          mode: "local",
          subject: "表达式与文本",
          extra: "匹配在独立线程执行并设 1.5 秒超时，避免灾难性回溯锁死页面。"
        }
      },
      {
        name: "文本工具箱",
        href: "/text-tools",
        icon: FileText,
        desc: "URL / HTML / Unicode / Base64 / 十六进制编解码，大小写与命名风格、全半角、行去重排序、字数统计，39 种转换一页搞定。",
        footer: {
          mode: "local",
          subject: "文本",
          extra: "转换结果可一键写回输入框连续处理，所有统计也只在本机计算。"
        }
      },
      {
        name: "Markdown 预览与互转",
        href: "/markdown",
        icon: FileCode2,
        desc: "双栏实时预览、文档大纲、GFM 表格与任务列表；导出 HTML / 打印 PDF，并支持 HTML 反向转 Markdown。",
        footer: {
          mode: "local",
          subject: "文档内容",
          extra: "预览 HTML 会先经 DOMPurify 净化，默认不执行文档内嵌的 HTML。"
        }
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
        desc: "必选清除隐私 + 可选压缩转格式，体积减少 40%~70%，纯前端处理。",
        footer: {
          mode: "local",
          subject: "图片",
          extra: "隐私保护为强制选项，确保上传安全。"
        }
      },
      {
        name: "背景虚化",
        href: "/image-background-blur",
        icon: Sparkles,
        desc: "涂抹主体自动虚化背景，模拟单反景深效果，纯前端零延迟。",
        footer: {
          mode: "local",
          subject: "图片",
          extra: "使用画笔涂抹主体即可，支持撤销与橡皮擦修正。"
        }
      },
      {
        name: "图片转 Base64",
        href: "/image-to-base64",
        icon: FileCode,
        desc: "一键将图片转换为 Base64 字符串，支持内联到 HTML/CSS 中，纯前端处理。",
        footer: {
          mode: "local",
          subject: "图片",
          extra: "支持复制带前缀或纯 Base64 数据。"
        }
      },
      {
        name: "图片工具套件",
        href: "/image-tools",
        icon: ImagePlus,
        desc: "文字水印、圆角裁剪、九宫格切图、ICO / favicon 生成、SVG 转 PNG，五个功能一页切换，结果可直接下载。",
        footer: {
          mode: "local",
          subject: "图片",
          extra: "绘制全部在 canvas 完成，ZIP 与 ICO 文件也在本机生成；单张图片限制 20 MB / 1600 万像素。"
        }
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
        desc: "按快捷键或点一下，直接拖动框选屏幕/窗口的任意区域，松开即完成并自动复制到剪贴板。",
        footer: {
          mode: "local",
          subject: "截图内容",
          extra: "截屏需要你在浏览器弹窗里手动选择要共享的画面，选择范围之外的内容不会被采集。"
        }
      },
      {
        name: "在线录屏",
        href: "/screen-record",
        icon: ScreenShare,
        desc: "无需插件录制屏幕、窗口或标签页，可混入系统声音与麦克风，支持暂停续录，直接下载 WebM。",
        footer: {
          mode: "local",
          subject: "录制内容",
          extra: "录制同样需要手动授权共享画面，停止共享或关闭页面即自动结束并释放采集。"
        }
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
        footer: {
          mode: "local",
          subject: "二维码内容与图片",
          extra: "摄像头画面只在本机逐帧分析，不录制、不上传；二维码内容请勿包含密码等敏感信息。"
        }
      },
      {
        name: "颜色与取色器",
        href: "/color",
        icon: Palette,
        desc: "HEX / RGB / HSL / CMYK 互转、屏幕吸色、WCAG 对比度检测、配色方案与图片主色调提取。",
        footer: {
          mode: "local",
          subject: "颜色与图片",
          extra: "屏幕取色需要浏览器支持 EyeDropper API（Chrome / Edge），Safari 与 Firefox 可手动输入色值。"
        }
      },
      {
        name: "单位与进制换算",
        href: "/unit-converter",
        icon: Ruler,
        desc: "长度、重量、温度、面积、体积、时间、数据、速度、压强九类单位换算，外加任意 2~36 进制互转（含小数）。",
        footer: {
          mode: "local",
          subject: "数值",
          extra: "月 / 年按平均长度估算；超出 JavaScript 安全整数范围的数值会明确报错，不给出近似答案。"
        }
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
        footer: {
          mode: "local",
          subject: "棋盘数据",
          extra: "最佳成绩只保存在你这台设备的浏览器里，清空站点数据会一并清除。"
        }
      },
      {
        name: "2048",
        href: "/game-2048",
        icon: Grid2x2,
        desc: "方向键或滑动合并同值数字，目标合成 2048；支持撤销一步，最高分自动记录。",
        footer: {
          mode: "local",
          subject: "游戏进度",
          extra: "最高分存在本机浏览器，不上传任何数据。"
        }
      },
      {
        name: "贪吃蛇",
        href: "/snake",
        icon: Worm,
        desc: "经典贪吃蛇，电脑用方向键、手机滑动或点屏幕方向键；三档速度，最高分自动记录。",
        footer: {
          mode: "local",
          subject: "游戏进度",
          extra: "最高分只存在这台设备的浏览器里，不上传任何数据。"
        }
      },
      {
        name: "五子棋",
        href: "/gomoku",
        icon: CircleDot,
        desc: "15 路棋盘，人机三档难度或同屏双人轮流；自动判五连、最后一手标记、支持悔棋。",
        footer: {
          mode: "local",
          subject: "对局数据",
          extra: "刷新或重开会清空当前棋局，不保留历史对局记录。"
        }
      },
    ]
  },
];

