// src/components/RecentBar.tsx
// 首页快捷入口：最近使用与收藏分成两组，没有记录时整块不渲染、不占版面。
"use client";

import Link from "next/link";
import { Clock3, Star } from "lucide-react";
import { toolsByHref, type SearchEntry } from "@/config/search";
import { usePreferences } from "./PreferencesProvider";

function QuickLinks({
  title, icon: Icon, entries, action,
}: {
  title: string;
  icon: React.ElementType;
  entries: SearchEntry[];
  action?: React.ReactNode;
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-600">
        <Icon className="w-4 h-4 text-indigo-500" />
        {title}
        <span className="text-xs font-normal text-slate-500">{entries.length} 个</span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {entries.map((entry) => {
          const ToolIcon = entry.icon;
          return (
            <Link
              key={entry.href}
              href={entry.href}
              title={entry.name}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              <ToolIcon className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-[10rem]">{entry.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function resolve(hrefs: string[]): SearchEntry[] {
  return hrefs
    .map((href) => toolsByHref.get(href))
    .filter((entry): entry is SearchEntry => Boolean(entry));
}

export default function RecentBar() {
  const { recent, favorites, ready, clearRecent } = usePreferences();
  const recentEntries = resolve(recent).slice(0, 8);
  const favoriteEntries = resolve(favorites).slice(0, 8);

  if (!ready || (recentEntries.length === 0 && favoriteEntries.length === 0)) return null;

  return (
    <section aria-label="快捷入口" className="mb-8 md:mb-10 space-y-5">
      <QuickLinks
        title="继续上次"
        icon={Clock3}
        entries={recentEntries}
        action={
          <button
            type="button"
            onClick={clearRecent}
            className="text-xs font-normal text-slate-500 hover:text-indigo-600 transition-colors"
          >
            清空记录
          </button>
        }
      />
      <QuickLinks title="我的收藏" icon={Star} entries={favoriteEntries} />
    </section>
  );
}
