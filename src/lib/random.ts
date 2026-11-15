// 只需要唯一标识（请求 id、列表 key）时用这个，不依赖 secure context。
// crypto.randomUUID() 在 http://局域网 IP / 部分 PWA 环境下不可用，getRandomValues 不受此限。
export function randomId(prefix = ""): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return prefix + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
