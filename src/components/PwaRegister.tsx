// src/components/PwaRegister.tsx
// 生产环境注册 Service Worker，并在断网时给出提示。
// 本地 localhost 不注册，避免开发/验证时被缓存的旧页面干扰。
"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export default function PwaRegister() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      const host = window.location.hostname;
      if (host !== "localhost" && host !== "127.0.0.1") {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // 注册失败不影响工具使用，静默降级为普通网页
        });
      }
    }

    const update = () => setOffline(!navigator.onLine);
    queueMicrotask(update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      当前离线，已访问过的工具仍可继续使用
    </div>
  );
}
