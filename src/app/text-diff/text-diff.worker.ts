// app/text-diff/text-diff.worker.ts
/// <reference lib="webworker" />

import * as Diff from "diff";

// ============ 类型定义 ============

export type DiffRequest = {
  type: "COMPUTE_DIFF";
  payload: {
    requestId: string;
    oldText: string;
    newText: string;
    mode: "chars" | "words" | "lines";
  };
};

// ✅ 自定义 DiffPart 类型（避免与 diff 库类型冲突）
export type DiffPart = {
  value: string;
  added?: boolean;
  removed?: boolean;
  count?: number;
};

export type DiffResponse =
  | {
      type: "DIFF_COMPLETE";
      payload: {
        requestId: string;
        diffs: DiffPart[];
        stats: {
          added: number;
          removed: number;
          unchanged: number;
        };
      };
    }
  | {
      type: "DIFF_ERROR";
      payload: {
        requestId: string;
        error: string;
      };
    };

// ============ Worker 主逻辑 ============

self.onmessage = function (e: MessageEvent<DiffRequest>) {
  const { type, payload } = e.data;

  if (type !== "COMPUTE_DIFF") return;

  const { requestId, oldText, newText, mode } = payload;

  try {
    // ✅ 使用正确的类型: Diff.Change[]
    let diffs: Diff.Change[];
    
    switch (mode) {
      case "chars":
        diffs = Diff.diffChars(oldText, newText);
        break;
      case "words":
        diffs = Diff.diffWords(oldText, newText);
        break;
      case "lines":
      default:
        diffs = Diff.diffLines(oldText, newText, { newlineIsToken: true });
        break;
    }

    // 转换为自定义 DiffPart 类型 + 统计
    const diffParts: DiffPart[] = diffs.map((d: Diff.Change) => ({
      value: d.value,
      added: d.added,
      removed: d.removed,
      count: d.count,
    }));

    const stats = diffParts.reduce(
      (acc, part) => {
        const len = part.count ?? part.value.length;
        if (part.added) acc.added += len;
        else if (part.removed) acc.removed += len;
        else acc.unchanged += len;
        return acc;
      },
      { added: 0, removed: 0, unchanged: 0 }
    );

    self.postMessage({
      type: "DIFF_COMPLETE",
      payload: {
        requestId,
        diffs: diffParts,
        stats,
      },
    });
  } catch (err: any) {
    self.postMessage({
      type: "DIFF_ERROR",
      payload: {
        requestId,
        error: err.message || "差异计算失败",
      },
    });
  }
};