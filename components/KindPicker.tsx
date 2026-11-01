"use client";

import { KIND_LABEL, kindsFor, type TransactionKind, type TransactionType } from "@/lib/transactionKind";
import KindIcon from "./KindIcon";
import Dropdown, { type DropdownOption } from "./Dropdown";
import { ALL_ICON } from "./dropdownOptions";

/**
 * 表單用:分類的圖示格子,點一下選取。支出 8 個(手機 4 欄、桌面一排 8 個),收入 4 個(一排 4 個)。
 * 訂閱只有支出,type 預設 expense。
 */
export function KindPicker<T extends TransactionKind>({
  type = "expense",
  value,
  onChange,
}: {
  type?: TransactionType;
  value: T;
  onChange: (kind: T) => void;
}) {
  const kinds = kindsFor(type) as readonly T[];
  return (
    <div
      role="radiogroup"
      aria-label="分類"
      className={`grid grid-cols-4 gap-1.5 ${kinds.length > 4 ? "sm:grid-cols-8" : ""}`}
    >
      {kinds.map((k) => {
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(k)}
            className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-xs transition-colors ${
              active
                ? "border-zinc-900 bg-zinc-100 font-medium text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-50"
                : "border-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <KindIcon kind={k} />
            {KIND_LABEL[k]}
          </button>
        );
      })}
    </div>
  );
}

/** 列表篩選用:下拉選單,每個選項前面附分類圖示("" = 全部分類)。 */
export function KindFilter({
  type,
  value,
  onChange,
}: {
  type: TransactionType;
  value: TransactionKind | "";
  onChange: (kind: TransactionKind | "") => void;
}) {
  const options: DropdownOption<TransactionKind | "">[] = [
    { value: "", label: "全部分類", icon: ALL_ICON },
    ...kindsFor(type).map((k) => ({
      value: k,
      label: KIND_LABEL[k],
      icon: <KindIcon kind={k} size="sm" />,
    })),
  ];
  return <Dropdown value={value} onChange={onChange} options={options} ariaLabel="分類" />;
}
