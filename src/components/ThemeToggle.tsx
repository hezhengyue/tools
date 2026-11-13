// src/components/ThemeToggle.tsx
// 三态外观切换：浅色 → 深色 → 跟随系统。侧栏用完整版，移动端顶栏用紧凑版。
"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { usePreferences, type Theme } from "./PreferencesProvider";

const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, themeLabel, cycleTheme } = usePreferences();
  const Icon = ICONS[theme];
  const label = `切换外观，当前：${themeLabel}`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={cycleTheme}
        aria-label={label}
        title={label}
        className="p-2 -mr-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <Icon className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={label}
      title={label}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 transition-colors"
    >
      <span className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        外观
      </span>
      <span className="text-xs font-medium px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
        {themeLabel}
      </span>
    </button>
  );
}
