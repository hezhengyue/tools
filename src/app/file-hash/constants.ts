// app/file-hash/constants.ts
// 主线程与 Worker 共用的协议定义；放在独立文件里，避免主线程 import 到 Worker 模块本体
// （Worker 模块顶层会写 self.onmessage，被主 bundle 执行会污染 window.onmessage）。

export const HASH_ALGOS = ["MD5", "SHA1", "SHA256", "SHA512"] as const;
export type HashAlgo = (typeof HASH_ALGOS)[number];
export type Hashes = Record<HashAlgo, string>;

export interface HashRequest {
  id: number;
  file: File;
}

export type HashResponse =
  | { type: "progress"; id: number; loaded: number; total: number }
  | { type: "done"; id: number; hashes: Hashes }
  | { type: "error"; id: number; message: string };

export const MAX_FILES = 8;
