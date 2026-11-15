// src/app/file-hash/hash.worker.ts
/// <reference lib="webworker" />

import { hashFile } from "./hash-core";
import type { HashRequest, HashResponse } from "./constants";

self.onmessage = async (event: MessageEvent<HashRequest>) => {
  const { id, file } = event.data;
  const respond = (payload: HashResponse) => self.postMessage(payload);

  try {
    const hashes = await hashFile(file, {
      onProgress: ({ loaded, total }) => respond({ type: "progress", id, loaded, total }),
    });
    respond({ type: "done", id, hashes });
  } catch (error) {
    respond({ type: "error", id, message: error instanceof Error ? error.message : String(error) });
  }
};
