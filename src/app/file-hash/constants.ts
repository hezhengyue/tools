// app/file-hash/constants.ts
// 算法清单与通用类型。计算全部在主线程完成（见 hash-core.ts），不再有 Worker 协议。

export const HASH_ALGOS = ["MD5", "SHA1", "SHA256", "SHA512"] as const;
export type HashAlgo = (typeof HASH_ALGOS)[number];
export type Hashes = Record<HashAlgo, string>;

export const MAX_FILES = 8;
