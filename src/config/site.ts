// src/config/site.ts
// 站点级文案与地址的唯一来源：metadata / 侧栏 / 移动端顶栏 / PWA 共用。

export const SITE_NAME = "正月工具箱";
export const SITE_SHORT_NAME = "正月工具";
export const SITE_DESCRIPTION = "为小白和开发者打造的极简现代在线工具集合站";

/** 部署时配置 NEXT_PUBLIC_SITE_URL（不含结尾斜杠），用于生成 canonical / OG 绝对地址。
 *  未配置时不会输出任何指向 localhost 的绝对链接。 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

export const SITE_KEYWORDS = [
  "在线工具", "工具箱", "开发者工具", "文本处理", "格式转换",
  "加密解密", "图片处理", "子网计算", "正则测试", "二维码",
  SITE_NAME, SITE_SHORT_NAME,
];
