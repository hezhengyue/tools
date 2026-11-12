// config/tools.ts
import {
  Key, FileJson, Shield, Code,
  Hash, KeyRound, FileBadge, FileDiff, Type, Palette, Gamepad, Gift,
  Image, FileImage, Sparkles, Globe, MonitorSmartphone, MapPin, FileCode,
  Camera, ScreenShare, Video
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
    ]
  },
  {
    category: "开发与转换",
    icon: Code,
    tools: [
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
    category: "游戏",
    icon: Gamepad,
    tools: [
      {
        name: "画板",
        href: "/draw-board",
        icon: Palette,
        desc: "轻量级在线画板，支持多色画笔、橡皮擦、撤销重做。",
        footer: { mode: "local", subject: "画布内容" }
      },
      {
        name: "随机抽奖",
        href: "/lucky-draw",
        icon: Gift,
        desc: "支持名单管理、自定义抽取人数、炫酷动画的在线抽奖工具。",
        footer: { mode: "local", subject: "名单数据" }
      },
    ]
  },
];

