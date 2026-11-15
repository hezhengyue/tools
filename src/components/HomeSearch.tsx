// src/components/HomeSearch.tsx
// 首页首要入口：把「搜索」提到最显眼的位置，工具清单退到下方分类区。
"use client";

import { ArrowRight, Search } from "lucide-react";
import { openCommandPalette, searchEntries } from "@/config/search";
import ShortcutHint from "./ShortcutHint";

export default function HomeSearch() {
  return (
    <header className="mb-8 md:mb-10">
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-3">
        欢迎回来 👋
      </h1>
      <p className="ui-prose text-slate-500 text-sm md:text-base mb-5">
        站内 {searchEntries.length} 个工具全部在浏览器本地运行。用搜索直达，或从下方分类慢慢逛。
      </p>
      <button
        type="button"
        onClick={openCommandPalette}
        aria-label="搜索工具或功能"
        className="group flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm hover:border-indigo-300 hover:shadow-md transition-all"
      >
        <Search className="w-5 h-5 shrink-0 text-indigo-600" />
        <span className="flex-1 min-w-0 truncate text-sm md:text-base text-slate-500 group-hover:text-slate-700">
          搜索工具、功能或关键词…
        </span>
        <ShortcutHint />
        <ArrowRight className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-indigo-500 transition-colors" />
      </button>
    </header>
  );
}
