"use client";

import { useRef, useState } from "react";
import { shiftPeriod } from "@/lib/period";
import { useDismiss } from "@/lib/useDismiss";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const NAV_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 active:scale-90 motion-reduce:transition-none dark:text-zinc-300 dark:hover:bg-zinc-800";

/**
 * 月份選擇("YYYY-MM"):左右箭頭切上 / 下個月,中間按鈕點開面板——上方切年份、下方 12 個月格子,
 * 底部「本月」一鍵回到這個月。本月有外框標示,選中的月份實心。
 */
export default function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (period: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => Number(value.slice(0, 4)));
  const rootRef = useRef<HTMLDivElement>(null);
  useDismiss(rootRef, open, () => setOpen(false));

  const [year, month] = value.split("-").map(Number);
  const today = currentPeriod();

  function toggle() {
    if (!open) setViewYear(year);
    setOpen((o) => !o);
  }

  function pick(period: string) {
    onChange(period);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700">
        <button type="button" onClick={() => onChange(shiftPeriod(value, -1))} aria-label="上一個月" className={NAV_BUTTON}>
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`選擇月份,目前 ${year} 年 ${month} 月`}
          className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          <CalendarDaysIcon className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          <span className="tabular-nums">
            {year} 年 {month} 月
          </span>
        </button>
        <button type="button" onClick={() => onChange(shiftPeriod(value, 1))} aria-label="下一個月" className={NAV_BUTTON}>
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="選擇月份"
          className="absolute left-0 top-full z-30 mt-2 w-64 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setViewYear((y) => y - 1)} aria-label="上一年" className={NAV_BUTTON}>
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{viewYear} 年</span>
            <button type="button" onClick={() => setViewYear((y) => y + 1)} aria-label="下一年" className={NAV_BUTTON}>
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: 12 }, (_, i) => {
              const period = `${viewYear}-${String(i + 1).padStart(2, "0")}`;
              const selected = period === value;
              const isCurrent = period === today;
              return (
                <button
                  key={period}
                  type="button"
                  onClick={() => pick(period)}
                  aria-pressed={selected}
                  className={`rounded-md py-2 text-sm transition-colors ${
                    selected
                      ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : isCurrent
                        ? "font-medium text-zinc-900 ring-1 ring-inset ring-zinc-400 hover:bg-zinc-100 dark:text-zinc-50 dark:ring-zinc-500 dark:hover:bg-zinc-800"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {i + 1}月
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-end border-t border-zinc-200 pt-2 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => pick(today)}
              className="rounded-md px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              本月
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
