// src/components/ShortcutHint.tsx
// 命令面板快捷键提示：Mac 显示 ⌘K，其它平台显示 Ctrl K。
// 首帧统一渲染 "Ctrl K" 避免水合不一致，挂载后再按 UA 修正。
"use client";

import { useEffect, useState } from "react";

export default function ShortcutHint() {
  const [label, setLabel] = useState("Ctrl K");

  useEffect(() => {
    queueMicrotask(() => {
      if (/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)) setLabel("⌘ K");
    });
  }, []);

  return <kbd className="ui-shortcut" aria-label={`快捷键 ${label}`}>{label}</kbd>;
}
