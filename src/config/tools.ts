import { Key, FileJson, Shield, Code, Calculator, Link as LinkIcon } from "lucide-react";

// 这是一个全局的工具配置表
export const toolsConfig = [
  {
    category: "安全与加密",
    icon: Shield,
    tools: [
      { name: "强密码生成", href: "/password", icon: Key, desc: "一键生成高强度、安全的随机密码，支持自定义长度。" },
      // 以后就在这里无脑往下加
      // { name: "MD5加密", href: "/md5", icon: Shield, desc: "快速计算字符串的 MD5 哈希值。" },
    ]
  },
  {
    category: "开发与转换",
    icon: Code,
    tools: [
      { name: "JSON 转 YAML", href: "/json2yaml", icon: FileJson, desc: "将复杂的 JSON 数据快速转换为结构清晰的 YAML 格式。" },
      // 以后就在这里无脑往下加
      // { name: "URL 编码/解码", href: "/urlcode", icon: LinkIcon, desc: "URL 链接快速编码解码工具。" },
    ]
  }
];
