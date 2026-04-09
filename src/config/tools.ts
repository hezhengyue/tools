// config/tools.ts
import { 
  Key, FileJson, Shield, Code, Calculator, Link as LinkIcon, 
  Hash, KeyRound, FileBadge, FileDiff, Type, Palette, Gamepad, Gift
} from "lucide-react";

export interface ToolItem {
  name: string;
  href: string;
  icon: React.ElementType;
  desc: string;
  /** 底部说明（支持简单 HTML，如 <strong>）*/
  footerNote?: string;
  /** 是否显示底部说明（默认 true）*/
  showFooter?: boolean;
  /** 自定义元数据（供工具内部使用）*/
  meta?: Record<string, any>;
}

export interface ToolCategory {
  category: string;
  icon: React.ElementType;
  tools: ToolItem[];
}

export const toolsConfig: ToolCategory[] = [
  {
    category: "游戏",
    icon: Gamepad,
    tools: [
      {
        name: "画板",
        href: "/draw-board",
        icon: Palette,
        desc: "轻量级在线画板，支持多色画笔、橡皮擦、撤销重做。",
        showFooter: false // 页面内已包含说明，无需底部提示
      },
      {
      name: "随机抽奖",
      href: "/lucky-draw",
      icon: Gift,
      desc: "支持名单管理、自定义抽取人数、炫酷动画的在线抽奖工具。",
      showFooter: false
    },
    ]
  },
  {
    category: "安全与加密",
    icon: Shield,
    tools: [
      {
        name: "强密码生成",
        href: "/password",
        icon: Key,
        desc: "一键生成高强度、安全的随机密码，支持自定义长度。",
        footerNote: "所有密码在浏览器本地生成，<strong>不会上传到任何服务器</strong>，请放心使用。"
      },
      { 
        name: "文本哈希计算", 
        href: "/hash-text", 
        icon: Hash, 
        desc: "快速计算文本的 MD5/SHA-1/SHA-256 等哈希值，支持多种加密算法。",
        footerNote: "哈希是单向函数，适合校验数据完整性，<strong>不可用于密码加密存储</strong>（请用 bcrypt/argon2）。所有计算均在本地完成。"
      },
      {
        name: "RSA 密钥生成",
        href: "/rsa-key",
        icon: KeyRound,
        desc: "浏览器本地生成 RSA 公钥/私钥对，支持 1024/2048/4096 位，输出 PEM 格式。",
        footerNote: "所有密钥在<strong>浏览器本地生成</strong>，不会上传到任何服务器。⚠️ 私钥请妥善保存，丢失无法恢复。"
      },
      {
        name: "自签证书生成",
        href: "/self-cert",
        icon: FileBadge,
        desc: "浏览器本地生成自签名 X.509 证书，支持 IP/域名 + SAN 扩展，输出标准 .key/.crt 文件。",
        footerNote: "所有证书在 <strong>浏览器本地生成</strong>，不会上传到任何服务器。⚠️ 自签证书需手动导入信任存储，生产环境建议使用权威 CA。"
      },
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
        footerNote: "所有对比计算在 <strong>浏览器本地完成</strong>，文本不会上传到服务器。"
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
        showFooter: false
      },
    ]
  }
];

// 辅助函数：根据 href 获取工具配置
export function getToolByHref(href: string): ToolItem | undefined {
  return toolsConfig.flatMap((cat) => cat.tools).find((tool) => tool.href === href);
}