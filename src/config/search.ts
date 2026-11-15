// src/config/search.ts
// 命令面板的检索索引：从 tools.ts 单一清单派生，别名只在这里补一份。
// 不引入搜索库，32 个工具直接打分排序即可。

import { toolsConfig } from "./tools";

export interface SearchEntry {
  name: string;
  href: string;
  desc: string;
  category: string;
  icon: React.ElementType;
  /** 小写检索串，预拼接避免每次输入都重新拼装 */
  haystack: string;
}

/** 常用英文 / 缩写 / 同义词。中文名称与描述已经足够覆盖大部分输入。 */
const ALIASES: Record<string, string> = {
  "/password": "pwd 口令 密码生成器 random password generator",
  "/hash-text": "md5 sha1 sha256 摘要 digest checksum 散列",
  "/file-hash": "md5 sha1 sha256 sha512 checksum 校验 完整性 文件摘要",
  "/ssh-key": "rsa ed25519 公私钥 keypair id_rsa",
  "/self-cert": "ssl tls x509 pem san csr 证书 自签名",
  "/jwt": "token bearer jsonwebtoken 解码 decode exp 过期",
  "/json-format": "json pretty 格式化 校验 压缩 ts interface",
  "/json-yaml": "yaml yml 转换 convert 互转 双向 yaml转json json转yaml",
  "/timestamp": "unix epoch 时间戳 毫秒 秒 日期 date",
  "/base64": "b64 encode decode dataurl 编码 解码",
  "/uuid": "guid nanoid 随机 id 唯一标识 v4 v7",
  "/cron": "crontab 定时任务 计划任务 表达式 schedule",
  "/device-info": "useragent ua 浏览器 设备 屏幕 gpu",
  "/ip-geo": "ip 归属地 地理位置 城市 运营商 geoip",
  "/ip-subnet": "cidr 掩码 netmask 网段 子网划分 广播 ipv4",
  "/text-diff": "diff 对比 差异 比较 compare",
  "/regex": "regexp 正则 匹配 捕获 替换 pattern",
  "/text-tools": "urlencode html 实体 unicode 全角 半角 大小写 驼峰 snake 去重 排序 字数",
  "/markdown": "md html 预览 preview 大纲 toc 文档 pdf",
  "/image-compress": "压缩 转格式 webp jpeg 隐私 exif compress",
  "/image-background-blur": "模糊 景深 虚化 背景 blur 抠图",
  "/image-to-base64": "dataurl 内联 base64 图片编码",
  "/image-tools": "水印 watermark 圆角 九宫格 切图 ico favicon svg png",
  "/screenshot": "截图 截屏 框选 capture screen 剪贴板",
  "/screen-record": "录屏 录制 屏幕共享 webm mediarecorder",
  "/qrcode": "qr 二维码 扫码 名片 vcard wifi 条形码",
  "/color": "hex rgb hsl cmyk 取色 吸色 对比度 配色 调色板 wcag",
  "/unit-converter": "进制 二进制 十六进制 长度 温度 单位 换算 conversion",
  "/minesweeper": "扫雷 地雷 mines 游戏",
  "/game-2048": "2048 合并 数字 游戏",
  "/snake": "贪吃蛇 snake 游戏",
  "/gomoku": "五子棋 连珠 gobang ai 人机 对弈",
};

function buildHaystack(name: string, desc: string, category: string, href: string, aliases: string) {
  return [name, desc, category, href.replace(/[-/]/g, " "), aliases]
    .join(" ")
    .toLowerCase();
}

export const searchEntries: SearchEntry[] = toolsConfig.flatMap((group) =>
  group.tools.map((tool) => {
    const aliases = ALIASES[tool.href] || "";
    return {
      name: tool.name,
      href: tool.href,
      desc: tool.desc,
      category: group.category,
      icon: tool.icon,
      haystack: buildHaystack(tool.name, tool.desc, group.category, tool.href, aliases),
    };
  })
);

export const toolsByHref = new Map(searchEntries.map((entry) => [entry.href, entry]));

/** 多关键词 AND 匹配；名称命中权重最高，别名次之，描述最低。 */
export function searchTools(query: string, limit = 12): SearchEntry[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const scored = searchEntries.map((entry) => {
    const name = entry.name.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (!entry.haystack.includes(term)) return { entry, score: -1 };
      if (name === term) score += 120;
      else if (name.startsWith(term)) score += 70;
      else if (name.includes(term)) score += 50;
      else if (entry.href.includes(term)) score += 30;
      else if (entry.desc.toLowerCase().includes(term)) score += 15;
      else score += 8;
    }
    return { entry, score };
  });

  return scored
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, "zh-CN"))
    .slice(0, limit)
    .map((item) => item.entry);
}

/** 侧栏、顶栏、首页共用：无需各自实现一遍事件名。 */
export function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("tools:open-search"));
  }
}
