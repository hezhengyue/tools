// src/components/PreferencesProvider.tsx
// 全站偏好：主题、收藏、最近使用。数据只存 localStorage，不上传。
// 首屏的 <html class="dark"> 由 layout.tsx 里的内联脚本提前写入（防闪烁），
// 这里负责之后的切换、跟随系统与持久化。
"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { toolsConfig } from "@/config/tools";

export type Theme = "light" | "dark" | "system";

const STORAGE = {
  theme: "tools.theme",
  favorites: "tools.favorites",
  recent: "tools.recent",
  categories: "tools.collapsedCategories",
} as const;
const MAX_RECENT = 8;
const ALL_CATEGORIES = toolsConfig.map((group) => group.category);

/**
 * 分类折叠按视图隔离：侧栏默认只展开当前分类、首页默认全展开，
 * 两者的基线不同，共用一个集合会让「侧栏点开一组」把首页折掉一大半。
 * 但读写仍只有这一个 hook / 一个 storage key，视图不需要自己判断。
 */
export type CategoryScope = "sidebar" | "home";
type CollapsedState = Record<CategoryScope, string[] | null>;
const EMPTY_COLLAPSED: CollapsedState = { sidebar: null, home: null };
const THEME_CYCLE: Theme[] = ["light", "dark", "system"];
const THEME_LABEL: Record<Theme, string> = {
  light: "浅色", dark: "深色", system: "跟随系统",
};

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function readStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function readCollapsedState(raw: string | null): CollapsedState {
  if (!raw) return EMPTY_COLLAPSED;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_COLLAPSED;
    const record = value as Record<string, unknown>;
    const pick = (scope: CategoryScope): string[] | null => {
      const list = record[scope];
      return Array.isArray(list)
        ? list.filter((item): item is string => typeof item === "string")
        : null;
    };
    return { sidebar: pick("sidebar"), home: pick("home") };
  } catch {
    return EMPTY_COLLAPSED;
  }
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark"
    || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content", dark ? "#0b1120" : "#f8fafc"
  );
}

interface PreferencesValue {
  theme: Theme;
  themeLabel: string;
  cycleTheme: () => void;
  favorites: string[];
  toggleFavorite: (href: string) => void;
  recent: string[];
  clearRecent: () => void;
  /** 按视图隔离的「已折叠分类」；null = 该视图从未手动折叠 */
  collapsed: CollapsedState;
  toggleCategory: (scope: CategoryScope, category: string, defaults: string[]) => void;
  ready: boolean;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences 必须在 PreferencesProvider 内使用");
  return value;
}

/**
 * 分类折叠的唯一入口。视图只需声明 scope + 「本视图默认展开哪些分类」，
 * 不必知道存储格式，也不要自己写展开/折叠判断：
 *   Sidebar → ("sidebar", [当前工具所属分类])
 *   HomeCategories → ("home", 全部分类)
 */
export function useCategoryExpansion(scope: CategoryScope, defaults: string[]) {
  const { collapsed, toggleCategory } = usePreferences();
  const list = collapsed[scope];
  const expanded = list === null
    ? defaults
    : ALL_CATEGORIES.filter((item) => !list.includes(item));
  const toggle = useCallback(
    (category: string) => toggleCategory(scope, category, defaults),
    [toggleCategory, scope, defaults]
  );
  return { expanded, toggle };
}

export default function PreferencesProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("system");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<CollapsedState>(EMPTY_COLLAPSED);
  const [ready, setReady] = useState(false);

  // 首帧不读浏览器存储，保证服务端 / 客户端水合一致
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const storedTheme = localStorage.getItem(STORAGE.theme);
        if (isTheme(storedTheme)) setTheme(storedTheme);
        setFavorites(readStringArray(localStorage.getItem(STORAGE.favorites)));
        setRecent(readStringArray(localStorage.getItem(STORAGE.recent)));
        setCollapsed(readCollapsedState(localStorage.getItem(STORAGE.categories)));
      } catch {
        // 隐私模式或存储被禁用时保持默认值
      }
      setReady(true);
    });
  }, []);

  // 主题应用到 <html>，与 theme-init.js 使用同一套判断
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE.theme, theme);
      localStorage.setItem(STORAGE.favorites, JSON.stringify(favorites));
      localStorage.setItem(STORAGE.recent, JSON.stringify(recent));
      // 两个视图都为 null 时表示「从未手动折叠」，不落盘，否则默认展开逻辑会失效
      if (collapsed.sidebar !== null || collapsed.home !== null) {
        localStorage.setItem(STORAGE.categories, JSON.stringify(collapsed));
      }
    } catch {
      // 存储不可用时功能降级为「当前会话有效」
    }
  }, [ready, theme, favorites, recent, collapsed]);

  // 多标签页同步
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE.theme && isTheme(event.newValue)) setTheme(event.newValue);
      if (event.key === STORAGE.favorites) setFavorites(readStringArray(event.newValue));
      if (event.key === STORAGE.recent) setRecent(readStringArray(event.newValue));
      if (event.key === STORAGE.categories) {
        setCollapsed(readCollapsedState(event.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // 只记录清单内的工具页，避免把首页 / 接口路由写进历史
  useEffect(() => {
    if (!ready) return;
    const known = toolsConfig.some((group) => group.tools.some((tool) => tool.href === pathname));
    if (!known) return;
    queueMicrotask(() => {
      setRecent((prev) => {
        if (prev[0] === pathname) return prev;
        return [pathname, ...prev.filter((href) => href !== pathname)].slice(0, MAX_RECENT);
      });
    });
  }, [pathname, ready]);

  const cycleTheme = useCallback(() => {
    setTheme((prev) => THEME_CYCLE[(THEME_CYCLE.indexOf(prev) + 1) % THEME_CYCLE.length]);
  }, []);

  const toggleFavorite = useCallback((href: string) => {
    setFavorites((prev) => prev.includes(href)
      ? prev.filter((item) => item !== href)
      : [href, ...prev]);
  }, []);

  const clearRecent = useCallback(() => setRecent([]), []);

  /** 只更新当前 scope 的集合，不影响另一个视图 */
  const toggleCategory = useCallback((scope: CategoryScope, category: string, defaults: string[]) => {
    setCollapsed((prev) => {
      const current = prev[scope];
      const expanded = current === null
        ? defaults
        : ALL_CATEGORIES.filter((item) => !current.includes(item));
      const next = expanded.includes(category)
        ? expanded.filter((item) => item !== category)
        : [...expanded, category];
      return { ...prev, [scope]: ALL_CATEGORIES.filter((item) => !next.includes(item)) };
    });
  }, []);

  const value = useMemo<PreferencesValue>(() => ({
    theme,
    themeLabel: THEME_LABEL[theme],
    cycleTheme,
    favorites,
    toggleFavorite,
    recent,
    clearRecent,
    collapsed,
    toggleCategory,
    ready,
  }), [theme, cycleTheme, favorites, toggleFavorite, recent, clearRecent,
    collapsed, toggleCategory, ready]);

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}
