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
} as const;
const MAX_RECENT = 8;
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
  ready: boolean;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences 必须在 PreferencesProvider 内使用");
  return value;
}

export default function PreferencesProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("system");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // 首帧不读浏览器存储，保证服务端 / 客户端水合一致
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const storedTheme = localStorage.getItem(STORAGE.theme);
        if (isTheme(storedTheme)) setTheme(storedTheme);
        setFavorites(readStringArray(localStorage.getItem(STORAGE.favorites)));
        setRecent(readStringArray(localStorage.getItem(STORAGE.recent)));
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
    } catch {
      // 存储不可用时功能降级为「当前会话有效」
    }
  }, [ready, theme, favorites, recent]);

  // 多标签页同步
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE.theme && isTheme(event.newValue)) setTheme(event.newValue);
      if (event.key === STORAGE.favorites) setFavorites(readStringArray(event.newValue));
      if (event.key === STORAGE.recent) setRecent(readStringArray(event.newValue));
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

  const value = useMemo<PreferencesValue>(() => ({
    theme,
    themeLabel: THEME_LABEL[theme],
    cycleTheme,
    favorites,
    toggleFavorite,
    recent,
    clearRecent,
    ready,
  }), [theme, cycleTheme, favorites, toggleFavorite, recent, clearRecent, ready]);

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}
