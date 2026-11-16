// app/regex/regex.ts
// 正则匹配在主线程执行。早前放在 Worker 里靠 1.5 秒超时兜底，但本站在部分托管平台上
// 拿不到 Worker 产物（请求返回 200 空体，消息永不回传），于是正常表达式也会被判成
// 「匹配超过 1.5 秒已强制终止」。改为同步执行，另外加两道更可靠的保险：
//   1) 嵌套量词 + 长文本直接拒绝（灾难性回溯的唯一常见成因）；
//   2) 每次 exec 之间检查耗时，超预算就给部分结果 + 明确提示。

export interface RegexMatch {
  index: number;
  value: string;
  groups: string[];
  named: Record<string, string> | null;
}

export interface RegexResult {
  ok: boolean;
  matches: RegexMatch[];
  replaced: string;
  /** 命中数或替换结果被截断 */
  truncated: boolean;
  /** 达到时间预算，结果只到中途 */
  budgetHit: boolean;
  error: string;
}

const MAX_MATCHES = 1000;
const MAX_TEXT = 200_000;
const MAX_REPLACED = 1_000_000;
const BUDGET_MS = 2000;

/** (a+)+ / (.*)* / (\w+\s?)* 这类「组里带量词、组外再量词」的写法 */
const NESTED_QUANTIFIER = /\((?:\\.|[^()\\])*[*+](?:\\.|[^()\\])*\)\s*(?:[*+]|\{\d+,\})/;

function toMatch(match: RegExpExecArray): RegexMatch {
  return {
    index: match.index,
    value: match[0],
    groups: match.slice(1),
    named: match.groups ? { ...match.groups } : null,
  };
}

export function hasNestedQuantifier(pattern: string): boolean {
  return NESTED_QUANTIFIER.test(pattern);
}

export function runRegex(
  pattern: string, flags: string, text: string, replacement: string,
): RegexResult {
  const empty: RegexResult = { ok: true, matches: [], replaced: "", truncated: false, budgetHit: false, error: "" };
  if (!pattern) return empty;

  if (text.length > MAX_TEXT) {
    return { ...empty, ok: false, error: `测试文本过长（上限 ${MAX_TEXT.toLocaleString()} 字符），请分段测试` };
  }

  // 嵌套量词的回溯次数是 2^n：40 个字符就能把主线程卡死几分钟，而主线程无法中途打断，
  // 只能在执行前拒绝，否则页面直接假死（比报错更糟）。
  if (hasNestedQuantifier(pattern)) {
    return {
      ...empty,
      ok: false,
      error: "表达式含嵌套量词（如 (a+)+、(.*)*），在稍长的文本上就会触发灾难性回溯把页面卡死，已提前拒绝执行。请改写为不嵌套的等价写法，例如把 (a+)+ 换成 a+。",
    };
  }

  let matcher: RegExp;
  try {
    matcher = new RegExp(pattern, flags);
  } catch (error) {
    return { ...empty, ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  const matches: RegexMatch[] = [];
  let truncated = false;
  let budgetHit = false;
  const startedAt = performance.now();

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
      if ((matches.length & 63) === 0 && performance.now() - startedAt > BUDGET_MS) {
        budgetHit = true;
        break;
      }
    }
  } else {
    const match = matcher.exec(text);
    if (match) matches.push(toMatch(match));
  }

  let replaced = "";
  try {
    // matcher 的 lastIndex 已被 exec 循环改动，替换必须用新实例
    replaced = text.replace(new RegExp(pattern, flags), replacement);
    if (replaced.length > MAX_REPLACED) {
      replaced = `${replaced.slice(0, MAX_REPLACED)}\n…（替换结果过长，已截断）`;
      truncated = true;
    }
  } catch (error) {
    replaced = `替换失败：${error instanceof Error ? error.message : String(error)}`;
  }

  return { ok: true, matches, replaced, truncated, budgetHit, error: "" };
}
