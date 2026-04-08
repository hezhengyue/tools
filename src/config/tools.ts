// config/tools.ts
import { Key, FileJson, Shield, Code, Calculator, Link as LinkIcon, Hash, KeyRound } from "lucide-react";

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
      icon: KeyRound,  // 或使用 Key
      desc: "浏览器本地生成 RSA 公钥/私钥对，支持 1024/2048/4096 位，输出 PEM 格式。",
      footerNote: "所有密钥在<strong>浏览器本地生成</strong>，不会上传到任何服务器。⚠️ 私钥请妥善保存，丢失无法恢复。"
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
        showFooter: false // 这个工具不需要底部说明
      },
    ]
  }
];

// 辅助函数：根据 href 获取工具配置
export function getToolByHref(href: string): ToolItem | undefined {
  return toolsConfig.flatMap((cat) => cat.tools).find((tool) => tool.href === href);
}