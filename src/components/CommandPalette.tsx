// src/components/CommandPalette.tsx
// Ctrl/⌘ + K 全局命令面板：跨分类检索全部工具，键盘直达，附带最近使用与收藏。
"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, Search, Star, X } from "lucide-react";
import { searchEntries, searchTools, toolsByHref, type SearchEntry } from "@/config/search";
import { usePreferences } from "./PreferencesProvider";

interface PaletteItem {
  entry: SearchEntry;
  group: string;
}

interface ResultRowProps {
  item: PaletteItem;
  index: number;
  active: boolean;
  favorite: boolean;
  onHover: (index: number) => void;
  onSelect: (entry: SearchEntry) => void;
  onToggleFavorite: (href: string) => void;
  rowRef?: (node: HTMLButtonElement | null) => void;
}

function ResultRow({
  item, index, active, favorite, onHover, onSelect, onToggleFavorite, rowRef,
}: ResultRowProps) {
  const { entry } = item;
  const Icon = entry.icon;
  return (
    <div
      role="option"
      aria-selected={active}
      id={`cmd-option-${index}`}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
        active ? "bg-indigo-50" : "hover:bg-slate-50"
      }`}
    >
      <button
        ref={rowRef}
        type="button"
        onClick={() => onSelect(entry)}
        onMouseEnter={() => onHover(index)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${
          active ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"
        }`}>
          <Icon className="w-4 h-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-medium truncate ${active ? "text-indigo-700" : "text-slate-700"}`}>
            {entry.name}
          </span>
          <span className="block text-xs text-slate-500 truncate">{entry.category} · {entry.desc}</span>
        </span>
        {active && <ArrowRight className="w-4 h-4 shrink-0 text-indigo-500" />}
      </button>
      <button
        type="button"
        onClick={() => onToggleFavorite(entry.href)}
        onMouseDown={(event) => event.preventDefault()}
        aria-label={favorite ? `取消收藏 ${entry.name}` : `收藏 ${entry.name}`}
        aria-pressed={favorite}
        title={favorite ? "取消收藏" : "收藏"}
        className={`shrink-0 p-1.5 rounded-lg transition-all ${
          favorite ? "text-amber-500" : "text-slate-400 hover:text-amber-500"
        } ${active || favorite ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
      >
        <Star className="w-4 h-4" fill={favorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

export default function CommandPalette() {
  const router = useRouter();
  const { recent, favorites, toggleFavorite } = usePreferences();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRowRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  const closePalette = useCallback(() => {
    setOpen(false);
    queueMicrotask(() => lastFocusRef.current?.focus());
  }, []);

  const openPalette = useCallback(() => {
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setActive(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) closePalette();
        else openPalette();
      } else if (event.key === "Escape" && open) {
        event.preventDefault();
        closePalette();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("tools:open-search", openPalette);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("tools:open-search", openPalette);
    };
  }, [open, openPalette, closePalette]);

  useEffect(() => {
    if (open) queueMicrotask(() => inputRef.current?.focus());
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    if (query.trim()) {
      return searchTools(query, 12).map((entry) => ({ entry, group: "搜索结果" }));
    }
    const list: PaletteItem[] = [];
    const seen = new Set<string>();
    const push = (group: string, hrefs: string[]) => {
      for (const href of hrefs) {
        if (seen.has(href)) continue;
        const entry = toolsByHref.get(href);
        if (!entry) continue;
        seen.add(href);
        list.push({ entry, group });
      }
    };
    push("最近使用", recent.slice(0, 4));
    push("我的收藏", favorites.slice(0, 5));
    push("全部工具", searchEntries.slice(0, 6).map((entry) => entry.href));
    return list.slice(0, 12);
  }, [query, recent, favorites]);

  /* 结果列表可能因输入/收藏变化变短，统一钳制索引，避免高亮与 Enter 落空 */
  const activeIndex = items.length > 0 ? Math.min(active, items.length - 1) : 0;

  useEffect(() => {
    if (open) activeRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const select = useCallback((entry: SearchEntry) => {
    router.push(entry.href);
    setOpen(false);
  }, [router]);

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(Math.max(index, 0) + 1, Math.max(items.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(Math.min(index, items.length - 1) - 1, 0));
    } else if (event.key === "Enter" && items[activeIndex]) {
      event.preventDefault();
      select(items[activeIndex].entry);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[8vh] sm:pt-[12vh]">
      <div className="cmd-backdrop absolute inset-0" onClick={closePalette} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="搜索工具"
        className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-3 px-4 border-b border-slate-200">
          <Search className="w-5 h-5 shrink-0 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(0); }}
            onKeyDown={onInputKeyDown}
            placeholder="搜索工具、功能或关键词…"
            aria-label="搜索工具"
            aria-controls="cmd-listbox"
            aria-activedescendant={items[activeIndex] ? `cmd-option-${activeIndex}` : undefined}
            className="flex-1 min-w-0 py-4 bg-transparent text-base text-slate-800 placeholder:text-slate-500 outline-none"
          />
          <button
            type="button"
            onClick={closePalette}
            aria-label="关闭搜索"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          id="cmd-listbox"
          role="listbox"
          aria-label="工具列表"
          className="max-h-[min(60vh,420px)] overflow-y-auto custom-scrollbar p-2"
        >
          {items.length === 0 && (
            <p className="ui-empty py-10">没有匹配的工具，换个关键词试试</p>
          )}
          {items.map((item, index) => (
            <div key={`${item.group}-${item.entry.href}`}>
              {(index === 0 || items[index - 1].group !== item.group) && (
                <p className="px-3 pt-2 pb-1 text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  {item.group === "最近使用" && <Clock3 className="w-3 h-3" />}
                  {item.group === "我的收藏" && <Star className="w-3 h-3" />}
                  {item.group}
                </p>
              )}
              <ResultRow
                item={item}
                index={index}
                active={index === activeIndex}
                favorite={favorites.includes(item.entry.href)}
                onHover={setActive}
                onSelect={select}
                onToggleFavorite={toggleFavorite}
                rowRef={index === activeIndex ? (node) => { activeRowRef.current = node; } : undefined}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
          <span className="hidden sm:inline">↑↓ 选择 · Enter 打开 · Esc 关闭</span>
          <span className="sm:hidden">点按结果即可打开</span>
          <span className="shrink-0">共 {searchEntries.length} 个工具</span>
        </div>
      </div>
    </div>
  );
}
