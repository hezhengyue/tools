// app/regex/regex.worker.ts
// 正则匹配放在 Worker 里执行：灾难性回溯（如 (a+)+$ 配长串）会卡死主线程，
// 主线程用超时 + terminate() 强制中止，保证页面永远不会被一条表达式锁住。
/// <reference lib="webworker" />

export interface RegexRequest {
  id: number;
  pattern: string;
  flags: string;
  text: string;
  replacement: string;
}

export interface RegexMatch {
  index: number;
  value: string;
  groups: string[];
  named: Record<string, string> | null;
}

export type RegexResponse =
  | {
      id: number;
      ok: true;
      matches: RegexMatch[];
      replaced: string;
      truncated: boolean;
    }
  | { id: number; ok: false; error: string };

const MAX_MATCHES = 1000;

function toMatch(match: RegExpExecArray): RegexMatch {
  return {
    index: match.index,
    value: match[0],
    groups: match.slice(1),
    named: match.groups ? { ...match.groups } : null,
  };
}

self.onmessage = (event: MessageEvent<RegexRequest>) => {
  const { id, pattern, flags, text, replacement } = event.data;
  const respond = (payload: RegexResponse) => self.postMessage(payload);

  try {
    if (!pattern) {
      respond({ id, ok: true, matches: [], replaced: "", truncated: false });
      return;
    }

    const matcher = new RegExp(pattern, flags);
    const matches: RegexMatch[] = [];
    let truncated = false;

    if (flags.includes("g")) {
      let match: RegExpExecArray | null;
      while ((match = matcher.exec(text)) !== null) {
        matches.push(toMatch(match));
        // 零宽匹配不会推进 lastIndex，手动 +1，否则死循环
        if (match[0] === "") matcher.lastIndex += 1;
        if (matches.length >= MAX_MATCHES) {
          truncated = true;
          break;
        }
      }
    } else {
      const match = matcher.exec(text);
      if (match) matches.push(toMatch(match));
    }

    // 重新建一个正则：matcher 的 lastIndex 已被 exec 循环改动，直接复用会漏掉开头
    let replaced = "";
    try {
      replaced = text.replace(new RegExp(pattern, flags), replacement);
    } catch (error) {
      replaced = `替换失败：${error instanceof Error ? error.message : String(error)}`;
    }

    respond({ id, ok: true, matches, replaced, truncated });
  } catch (error) {
    respond({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
