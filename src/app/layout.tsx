// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import MobileHeader from "../components/MobileHeader";
import PreferencesProvider from "../components/PreferencesProvider";
import CommandPalette from "../components/CommandPalette";
import PwaRegister from "../components/PwaRegister";
import {
  SITE_NAME, SITE_SHORT_NAME, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_URL,
} from "@/config/site";

// 静态常量，不含任何用户输入：在水合前同步写入 dark class，避免深色模式闪白。
// 逻辑与 PreferencesProvider.tsx 的 applyTheme 保持一致。
const THEME_INIT = `(function(){try{var t=localStorage.getItem('tools.theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'#0b1120':'#f8fafc');}catch(e){}})();`;

export const metadata: Metadata = {
  // 只有部署时配置了站点地址才输出绝对 URL，避免 localhost 出现在 canonical / OG 上
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/logo.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: SITE_SHORT_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    ...(SITE_URL
      ? { url: SITE_URL, images: [{ url: "/og.jpg", width: 1200, height: 630, alt: SITE_NAME }] }
      : {}),
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 不设置 maximumScale / userScalable: false —— 允许用户缩放（WCAG 1.4.4）
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // 下面 THEME_INIT 会在水合前改写 <html> 的 class，故需 suppressHydrationWarning
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f8fafc" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="font-sans flex h-screen bg-slate-50/50 overflow-hidden">
        <PreferencesProvider>
          <Sidebar className="hidden md:flex" />
          <main className="relative min-w-0 flex-1 overflow-auto">
            <MobileHeader />
            <div className="ui-page min-h-full">
              {children}
            </div>
          </main>
          <CommandPalette />
          <PwaRegister />
        </PreferencesProvider>
      </body>
    </html>
  );
}
