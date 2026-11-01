"use client";

import { useEffect, type RefObject } from "react";

/**
 * 彈出面板(下拉選單、日期 / 月份選擇)共用:開啟時點到 ref 以外的地方或按 Esc 就呼叫 onDismiss。
 * 只在 open 變化時綁定事件,onDismiss 用開啟當下那一個(只是用來關閉面板,不需要最新的閉包)。
 */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onDismiss();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ref]);
}
