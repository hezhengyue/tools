// app/text-tools/text-utils.ts
// 文本转换的纯函数集合：不依赖 DOM，方便单独验证与复用。

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
};

/** URL 编码：form 模式把空格写成 +（application/x-www-form-urlencoded） */
export function urlEncode(text: string, form = false): string {
  const encoded = encodeURIComponent(text);
  return form ? encoded.replace(/%20/g, "+") : encoded;
}

export function urlDecode(text: string, form = false): string {
  return decodeURIComponent(form ? text.replace(/\+/g, " ") : text);
}

export function htmlEncode(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 借助 textarea 的 RCDATA 解析，浏览器会还原全部命名实体与数字实体，且不会执行脚本 */
export function htmlDecode(text: string): string {
  if (typeof document === "undefined") {
    return text.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (all, hex, dec, name) => {
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      if (dec) return String.fromCodePoint(parseInt(dec, 10));
      return NAMED_ENTITIES[name.toLowerCase()] ?? all;
    });
  }
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

/** 转成 \uXXXX；超出 BMP 的字符拆成代理对，兼容 JS/Java/JSON 等常见转义 */
export function unicodeEscape(text: string): string {
  let out = "";
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp <= 0xffff) {
      out += `\\u${cp.toString(16).padStart(4, "0")}`;
    } else {
      const value = cp - 0x10000;
      const high = 0xd800 + (value >> 10);
      const low = 0xdc00 + (value & 0x3ff);
      out += `\\u${high.toString(16)}\\u${low.toString(16)}`;
    }
  }
  return out;
}

export function unicodeUnescape(text: string): string {
  return text.replace(/\\u\{([0-9a-f]{1,6})\}|\\u([0-9a-f]{4})/gi, (_, brace, plain) => {
    const cp = parseInt(brace ?? plain, 16);
    return cp <= 0x10ffff ? String.fromCodePoint(cp) : _
  });
}

const encoder = new TextEncoder();

/** 十六进制字节串（UTF-8），如 "e4 b8 ad" */
export function toHexBytes(text: string): string {
  return Array.from(encoder.encode(text), (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

export function fromHexBytes(text: string): string {
  const clean = text.replace(/0x/gi, "").replace(/[^0-9a-f]/gi, "");
  if (clean.length % 2 !== 0) throw new Error("十六进制字符数必须为偶数");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function toBase64(text: string): string {
  const bytes = encoder.encode(text);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function fromBase64(text: string): string {
  const binary = atob(text.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** 全角 ↔ 半角：ASCII 可打印字符与全角区一一对应，空格单独处理 */
export function toFullWidth(text: string): string {
  return Array.from(text, (char) => {
    const code = char.charCodeAt(0);
    if (code === 0x20) return "\u3000";
    if (code >= 0x21 && code <= 0x7e) return String.fromCharCode(code + 0xfee0);
    return char;
  }).join("");
}

export function toHalfWidth(text: string): string {
  return Array.from(text, (char) => {
    const code = char.charCodeAt(0);
    if (code === 0x3000) return " ";
    if (code >= 0xff01 && code <= 0xff5e) return String.fromCharCode(code - 0xfee0);
    return char;
  }).join("");
}

/** 按非字母数字、驼峰边界和 CJK 边界分词，用于命名风格互转 */
export function splitWords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-zA-Z0-9])([\u4e00-\u9fff])/g, "$1 $2")
    .replace(/([\u4e00-\u9fff])([a-zA-Z0-9])/g, "$1 $2")
    .split(/[^a-zA-Z0-9\u4e00-\u9fff]+/)
    .filter(Boolean);
}

export type CaseStyle = "upper" | "lower" | "title" | "sentence" | "invert" | "camel" | "pascal" | "snake" | "kebab" | "constant";

export function changeCase(text: string, style: CaseStyle): string {
  switch (style) {
    case "upper": return text.toUpperCase();
    case "lower": return text.toLowerCase();
    case "invert":
      return Array.from(text, (char) =>
        char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase()).join("");
    case "title":
      return text.replace(/(\p{L})(\p{L}*)/gu, (_, first: string, rest: string) =>
        first.toUpperCase() + rest.toLowerCase());
    case "sentence":
      return text.replace(/(^|[.!?。！？\n]\s*)(\p{L})/gu, (_all, prefix: string, first: string) =>
        prefix + first.toUpperCase());
    case "camel":
    case "pascal": {
      const words = splitWords(text);
      const body = words.map((word, index) =>
        index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join("");
      return style === "pascal" ? body.charAt(0).toUpperCase() + body.slice(1) : body;
    }
    case "snake":
    case "kebab":
    case "constant": {
      const words = splitWords(text);
      const joined = words.join(style === "kebab" ? "-" : "_");
      return style === "constant" ? joined.toUpperCase() : joined.toLowerCase();
    }
  }
}

export type LineAction = "dedupe" | "sort" | "sortDesc" | "reverse" | "trim" | "dropEmpty" | "number" | "shuffle" | "join" | "uniqueChars";

export function processLines(text: string, action: LineAction): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  switch (action) {
    case "dedupe": return Array.from(new Set(lines)).join("\n");
    case "sort": return [...lines].sort((a, b) => a.localeCompare(b, "zh-CN")).join("\n");
    case "sortDesc": return [...lines].sort((a, b) => b.localeCompare(a, "zh-CN")).join("\n");
    case "reverse": return lines.reverse().join("\n");
    case "trim": return lines.map((line) => line.trim()).join("\n");
    case "dropEmpty": return lines.filter((line) => line.trim() !== "").join("\n");
    case "number": return lines.map((line, index) => `${index + 1}. ${line}`).join("\n");
    case "shuffle": {
      const copy = [...lines];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.join("\n");
    }
    case "join": return lines.map((line) => line.trim()).filter(Boolean).join(" ");
    case "uniqueChars": return Array.from(new Set(Array.from(text))).join("");
  }
}

export function normalizeWhitespace(text: string, mode: "collapse" | "linebreak" | "tabs" | "compact" | "blankLines"): string {
  switch (mode) {
    case "collapse": return text.replace(/[^\S\n]+/g, " ").replace(/ +\n/g, "\n");
    case "linebreak": return text.replace(/\r\n?/g, "\n");
    case "tabs": return text.replace(/\t/g, "    ");
    case "compact": return text.replace(/\s+/g, "");
    case "blankLines": return text.replace(/\n{3,}/g, "\n\n");
  }
}

export interface TextStats {
  chars: number;
  charsNoSpace: number;
  words: number;
  lines: number;
  paragraphs: number;
  bytes: number;
  cjk: number;
  letters: number;
  digits: number;
}

export function textStats(text: string): TextStats {
  const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) ?? []).length;
  const words = (text.match(/[a-zA-Z0-9_]+(?:['’-][a-zA-Z0-9_]+)*/g) ?? []).length;
  return {
    chars: Array.from(text).length,
    charsNoSpace: Array.from(text.replace(/\s/g, "")).length,
    words: words + cjk,
    lines: text === "" ? 0 : text.split(/\r\n|\r|\n/).length,
    paragraphs: text.split(/\n\s*\n/).filter((part) => part.trim() !== "").length,
    bytes: encoder.encode(text).length,
    cjk,
    letters: (text.match(/[a-zA-Z]/g) ?? []).length,
    digits: (text.match(/[0-9]/g) ?? []).length,
  };
}
