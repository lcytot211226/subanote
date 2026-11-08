"use client";

import type { ComponentType } from "react";
import { ArrowPathIcon, UserGroupIcon } from "./icons";

/** 只有圖示的開關按鈕,文字說明放在 title / aria-label。 */
export function IconToggleButton({
  on,
  onToggle,
  Icon,
  onLabel,
  offLabel,
  onClassName,
}: {
  on: boolean;
  onToggle: () => void;
  Icon: ComponentType<{ className?: string }>;
  onLabel: string;
  offLabel: string;
  /** 開啟時的配色 */
  onClassName: string;
}) {
  const label = on ? onLabel : offLabel;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`flex shrink-0 items-center rounded-md border p-1.5 transition-colors ${
        on ? onClassName : "border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/**
 * 「是否計入共享資料」的圖示開關:/overview 月檢視放在「其他」標題列、每日支出與分類統計標題列的最右邊,房租水電區塊標題列最右邊也有一個(全部同一個 state);年度檢視圖表的圖例最右邊另有一個(年度自己的 state)。
 * 計入時用淡靛藍色,避開圖表的收入綠 / 支出紅。
 */
export default function SharedToggleButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <IconToggleButton
      on={on}
      onToggle={onToggle}
      Icon={UserGroupIcon}
      onLabel="已計入共享資料,點擊取消"
      offLabel="計入共享資料"
      onClassName="border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
    />
  );
}

/** 每日支出圖表要不要畫進分期與訂閱(兩者都是每月重複的扣款,用循環箭頭表示)。 */
export function InstallmentToggleButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <IconToggleButton
      on={on}
      onToggle={onToggle}
      Icon={ArrowPathIcon}
      onLabel="已包含分期與訂閱,點擊取消"
      offLabel="包含分期與訂閱"
      onClassName="border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
    />
  );
}
