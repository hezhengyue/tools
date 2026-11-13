// src/config/metadata.ts
// 每个工具页的 metadata 由同目录下的服务端 layout.tsx 导出，因为工具页本身是
// "use client"，Next.js 不允许在客户端组件里导出 metadata。

import type { Metadata } from "next";
import { toolsConfig } from "./tools";
import { SITE_NAME, SITE_URL } from "./site";

export interface ToolMeta {
  name: string;
  desc: string;
  category: string;
  href: string;
}

const toolIndex = new Map<string, ToolMeta>(
  toolsConfig.flatMap((group) =>
    group.tools.map((tool) => [
      tool.href,
      { name: tool.name, desc: tool.desc, category: group.category, href: tool.href },
    ] as const)
  )
);

export function allToolHrefs(): string[] {
  return [...toolIndex.keys()];
}

export function getToolMeta(href: string): ToolMeta | undefined {
  return toolIndex.get(href);
}

/** 生成单页 metadata；站点地址未配置时不输出绝对 URL，避免 localhost 泄漏到线上。 */
export function toolMetadata(href: string): Metadata {
  const tool = toolIndex.get(href);
  if (!tool) return {};

  const fullTitle = `${tool.name} | ${SITE_NAME}`;
  // Next.js 的 openGraph / twitter 是整体替换而非与根布局深合并，
  // 所以这里必须把 siteName、locale、图片一并写全，否则 32 个工具页会丢掉站点级 OG 信息。
  const meta: Metadata = {
    title: tool.name, // 根 layout 的 title.template 会补上站点名
    description: tool.desc,
    keywords: [tool.name, tool.category, ...tool.name.split(/[\s/]+/).filter(Boolean)],
    openGraph: {
      type: "website",
      locale: "zh_CN",
      siteName: SITE_NAME,
      title: fullTitle,
      description: tool.desc,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: tool.desc,
    },
  };

  // 相对地址需要 metadataBase 才能解析成绝对 URL，所以只在配置了站点地址时输出
  if (SITE_URL) {
    const absolute = `${SITE_URL}${href}`;
    meta.alternates = { canonical: href };
    meta.openGraph = {
      ...meta.openGraph,
      url: absolute,
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: fullTitle }],
    };
    meta.twitter = { ...meta.twitter, images: ["/og.jpg"] };
  }
  return meta;
}
