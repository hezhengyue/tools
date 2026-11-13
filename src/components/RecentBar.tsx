// src/components/RecentBar.tsx
// 首页顶部的「继续上次」入口；没有记录时不渲染，不占版面。
"use client";

import Link from "next/link";
import { Clock3, Star } from "lucide-react";
import { toolsByHref } from "@/config/search";
import { usePreferences } from "./PreferencesProvider";

export default function RecentBar() {
  const { recent, favorites, ready } = usePreferences();
  const entries = recent
    .map((href) => toolsByHref.get(href))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .slice(0, 5);

  if (!ready || (entries.length === 0 && favorites.length === 0)) return null;

  return (
    <section aria-label="最近使用" className="mb-8 md:mb-10">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-600">
        <Clock3 className="w-4 h-4 text-indigo-500" />
        继续上次
        {favorites.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-normal text-slate-500">
            <Star className="w-3 h-3" /> 已收藏 {favorites.length} 个
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-[10rem]">{entry.name}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
