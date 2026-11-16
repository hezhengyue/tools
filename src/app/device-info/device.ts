// app/device-info/device.ts
// 设备信息的采集层。浏览器出于隐私会主动「打折」上报：设备内存只给 2 的幂近似值、
// UA 里的系统版本被冻结、GPU 型号可能被屏蔽。这里优先用 User-Agent Client Hints
// 拿更准的平台版本与 CPU 架构，拿不到就退回 UA 解析，并且明确告诉用户哪一项是上限值。

interface UadValues {
  platformVersion?: string;
  architecture?: string;
  bitness?: string;
  model?: string;
}

interface UadLike {
  platform?: string;
  mobile?: boolean;
  getHighEntropyValues?: (hints: string[]) => Promise<UadValues>;
}

export interface DeviceInfo {
  browser: string;
  browserVersion: string;
  language: string;
  languages: string[];

  os: string;
  osVersion: string;
  arch: string;
  cpu: string;
  memory: string;
  /** 内存是浏览器四舍五入后的近似值，可能是上限截断 */
  memoryApprox: boolean;

  gpuName: string;
  gpuVendor: string;

  screenLogical: string;
  screenPhysical: string;
  screenAvailable: string;
  pixelRatio: string;
  colorDepth: string;
  orientation: string;
  touchPoints: number;

  timezone: string;
  utcOffset: string;
  localTime: string;

  userAgent: string;
}

function parseBrowser(ua: string) {
  // 各类 Chromium 分支 / iOS 版浏览器必须在通用 "Chrome/"、"Safari/" 之前判断，
  // 否则 Opera、Samsung Internet、iOS 版 Chrome 都会被误报成 Chrome 或 Safari。
  const brands: [RegExp, string][] = [
    [/OPR\/([\d.]+)/, "Opera"],
    [/EdgiOS\/([\d.]+)/, "Edge (iOS)"],
    [/CriOS\/([\d.]+)/, "Chrome (iOS)"],
    [/FxiOS\/([\d.]+)/, "Firefox (iOS)"],
    [/EdgA?\/([\d.]+)/, "Microsoft Edge"],
    [/SamsungBrowser\/([\d.]+)/, "Samsung Internet"],
    [/QQBrowser\/([\d.]+)/, "QQ 浏览器"],
    [/MicroMessenger\/([\d.]+)/, "微信内置浏览器"],
    [/Electron\/([\d.]+)/, "Electron"],
  ];
  for (const [pattern, name] of brands) {
    const match = ua.match(pattern);
    if (match) return { name, version: match[1] || "未知" };
  }

  if (ua.includes("Chrome/")) {
    return { name: "Google Chrome", version: ua.match(/Chrome\/([\d.]+)/)?.[1] || "未知" };
  }
  if (ua.includes("Firefox/")) {
    return { name: "Mozilla Firefox", version: ua.match(/Firefox\/([\d.]+)/)?.[1] || "未知" };
  }
  if (ua.includes("Safari/")) {
    return { name: "Safari", version: ua.match(/Version\/([\d.]+)/)?.[1] || "未知" };
  }
  return { name: "未知浏览器", version: "未知" };
}

function parseOsFromUa(ua: string) {
  // iOS 的 UA 含 "like Mac OS X"，必须先于 macOS 判断，否则一律误报成 macOS
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("CrOS")) return "ChromeOS";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac")) {
    if (/Mobile\/\w+/.test(ua)) return "iPadOS";
    if (typeof navigator !== "undefined" && navigator.maxTouchPoints > 1) return "iPadOS";
    return "macOS";
  }
  if (ua.includes("Linux")) return "Linux";
  return "未知系统";
}

const UAD_OS_NAME: Record<string, string> = {
  Windows: "Windows",
  macOS: "macOS",
  "Chrome OS": "ChromeOS",
  Android: "Android",
  Linux: "Linux",
  iOS: "iOS",
};

/** Chrome 的 Windows 平台版本号与系统版本不是同一套数字，需要映射 */
function windowsName(version: string): string {
  const major = Number(version.split(".")[0]);
  if (!Number.isFinite(major)) return "Windows";
  if (major >= 13) return "Windows 11";
  if (major === 10) return "Windows 10";
  if (version.startsWith("0.3")) return "Windows 8.1";
  if (version.startsWith("0.2")) return "Windows 8";
  if (version.startsWith("0.1")) return "Windows 7";
  return "Windows";
}

function describeArch(architecture?: string, bitness?: string): string {
  if (!architecture && !bitness) return "浏览器不提供";
  const bits = bitness ? `${bitness} 位` : "";
  const name = architecture === "x86" ? "x86" : architecture === "arm" ? "ARM" : architecture || "未知架构";
  return bits ? `${name}（${bits}）` : name;
}

function describeOrientation(type?: string): string {
  switch (type) {
    case "landscape-primary": return "横屏（主方向）";
    case "landscape-secondary": return "横屏（副方向）";
    case "portrait-primary": return "竖屏（主方向）";
    case "portrait-secondary": return "竖屏（副方向）";
    default: return window.innerHeight >= window.innerWidth ? "竖屏" : "横屏";
  }
}

function utcOffsetLabel(): string {
  // getTimezoneOffset 返回「本地时间比 UTC 晚多少分钟」，东八区为 -480
  const minutes = -new Date().getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

function getGpuInfo() {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return { gpuName: "浏览器已屏蔽", gpuVendor: "浏览器已屏蔽" };

    const ext = gl.getExtension("WEBGL_debug_renderer_info") as
      | { UNMASKED_RENDERER_WEBGL: number; UNMASKED_VENDOR_WEBGL: number }
      | null;
    if (!ext) return { gpuName: "浏览器已屏蔽", gpuVendor: "浏览器已屏蔽" };

    const renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "");
    const vendor = String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || "");

    let gpuName = renderer;
    // ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)
    // → 取第二个字段（适配器描述），再剥掉驱动尾注，只留芯片名
    const angle = renderer.match(/^ANGLE\s*\(\s*([^,]*),\s*([\s\S]*)\)\s*$/i);
    if (angle) gpuName = angle[2];
    gpuName = gpuName
      .replace(/\s*\(0x[0-9a-f]+\)/gi, "")
      .replace(/\s*(?:Direct3D\d*|D3D\d*|vs_[\d_]+|ps_[\d_]+)\b.*$/i, "")
      .replace(/^Google\s+/i, "")
      .replace(/[\s,]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // 厂商以渲染器字符串为准：ANGLE 的 vendor 字段常常只有 "Google Inc. (Microsoft)"
    const haystack = `${renderer} ${vendor}`;
    let gpuVendor = vendor;
    if (/NVIDIA/i.test(haystack)) gpuVendor = "NVIDIA";
    else if (/Intel/i.test(haystack)) gpuVendor = "Intel";
    else if (/AMD|ATI|Radeon/i.test(haystack)) gpuVendor = "AMD";
    else if (/Apple/i.test(haystack)) gpuVendor = "Apple";
    else if (/Qualcomm|Adreno/i.test(haystack)) gpuVendor = "Qualcomm";
    else if (/Mali/i.test(haystack)) gpuVendor = "ARM";
    else if (/Microsoft/i.test(haystack)) gpuVendor = "Microsoft";

    return { gpuName: gpuName || "未知", gpuVendor: gpuVendor || "未知" };
  } catch {
    return { gpuName: "读取失败", gpuVendor: "读取失败" };
  }
}

export async function collectDeviceInfo(): Promise<DeviceInfo> {
  const ua = navigator.userAgent;
  const nav = navigator as Navigator & { userAgentData?: UadLike };
  let hints: UadValues = {};
  try {
    hints = (await nav.userAgentData?.getHighEntropyValues?.([
      "platformVersion", "architecture", "bitness", "model",
    ])) ?? {};
  } catch {
    // Safari / Firefox 没有 UA-CH，忽略即可
  }

  const browser = parseBrowser(ua);
  const gpu = getGpuInfo();

  const platform = nav.userAgentData?.platform ?? "";
  const osFromHints = UAD_OS_NAME[platform];
  const osFromUa = parseOsFromUa(ua);
  const osVersion = hints.platformVersion ?? "";

  let os = osFromHints || osFromUa;
  if (os === "Windows" && osVersion) os = windowsName(osVersion);
  else if (os === "iOS" && !hints.platformVersion) {
    const version = ua.match(/OS (\d+)[._](\d+)/);
    if (version) hints = { ...hints, platformVersion: `${version[1]}.${version[2]}` };
  }

  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency;
  const dpr = window.devicePixelRatio || 1;

  const now = new Date();

  return {
    browser: browser.name,
    browserVersion: browser.version,
    language: navigator.language,
    languages: [...navigator.languages],

    os,
    osVersion: hints.platformVersion || "浏览器不提供",
    arch: describeArch(hints.architecture, hints.bitness),
    cpu: cores ? `${cores} 线程` : "浏览器不提供",
    // deviceMemory 只给 2 的幂近似值（0.25 / 0.5 / 1 / 2 / 4 / 8 / 16），旧版 Chromium 还会截断到 8
    memory: deviceMemory ? `${deviceMemory} GB` : "浏览器不提供",
    memoryApprox: Boolean(deviceMemory),

    gpuName: gpu.gpuName,
    gpuVendor: gpu.gpuVendor,

    screenLogical: `${screen.width} × ${screen.height}`,
    screenPhysical: `${Math.round(screen.width * dpr)} × ${Math.round(screen.height * dpr)}`,
    screenAvailable: `${screen.availWidth} × ${screen.availHeight}`,
    pixelRatio: dpr.toFixed(dpr % 1 === 0 ? 0 : 2),
    colorDepth: `${screen.colorDepth} 位${screen.pixelDepth && screen.pixelDepth !== screen.colorDepth ? ` / 像素 ${screen.pixelDepth} 位` : ""}`,
    orientation: describeOrientation(screen.orientation?.type),
    touchPoints: navigator.maxTouchPoints ?? 0,

    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    utcOffset: utcOffsetLabel(),
    localTime: now.toLocaleString("zh-CN", { hour12: false }),

    userAgent: ua,
  };
}
