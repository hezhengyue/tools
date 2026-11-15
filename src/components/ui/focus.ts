// 模态容器的键盘焦点工具。抽屉与命令面板共用同一套规则，避免各写一份导致行为不一致。

/** 只依赖这几个字段，原生 window keydown 与 React 合成事件都能直接使用 */
interface TabKeyEvent {
  key: string;
  shiftKey: boolean;
  preventDefault: () => void;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** 在容器内循环 Tab / Shift+Tab。挂在模态容器的 onKeyDown 上即可。 */
export function trapTabFocus(event: TabKeyEvent, container: HTMLElement | null): void {
  if (event.key !== "Tab" || !container) return;
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((node) => node.offsetParent !== null);
  if (nodes.length === 0) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const active = document.activeElement;
  if (!container.contains(active)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
