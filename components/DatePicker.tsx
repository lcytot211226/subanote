"use client";

import { useRef, useState } from "react";
import { useDismiss } from "@/lib/useDismiss";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 本地日期 → "YYYY-MM-DD" */
export function toDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shiftDays(value: string, days: number) {
  const d = parseDate(value);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

const NAV_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 active:scale-90 motion-reduce:transition-none dark:text-zinc-300 dark:hover:bg-zinc-800";

/**
 * 日期選擇("YYYY-MM-DD",本地日期):按鈕顯示「2026/11/01(日)」,點開是月曆面板。
 * 今天有外框標示、選中的日期實心;底部「昨天 / 今天」快速選。
 * showDayShift 時按鈕兩側加上前一天 / 後一天的箭頭(交易表單用,連續補記很方便)。
 */
export default function DatePicker({
  value,
  onChange,
  ariaLabel,
  showDayShift = false,
}: {
  value: string;
  onChange: (date: string) => void;
  ariaLabel: string;
  showDayShift?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => value.slice(0, 7));
  const rootRef = useRef<HTMLDivElement>(null);
  useDismiss(rootRef, open, () => setOpen(false));

  const selected = parseDate(value);
  const today = toDateString(new Date());
  const label = `${value.replaceAll("-", "/")}(${WEEKDAYS[selected.getDay()]})`;

  // 面板顯示的月份:前面補上個月的空格,湊滿整週
  const [viewYear, viewMon] = viewMonth.split("-").map(Number);
  const firstWeekday = new Date(viewYear, viewMon - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMon, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${viewMonth}-${String(i + 1).padStart(2, "0")}`),
  ];

  function shiftViewMonth(delta: number) {
    const d = new Date(viewYear, viewMon - 1 + delta, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function toggle() {
    if (!open) setViewMonth(value.slice(0, 7));
    setOpen((o) => !o);
  }

  function pick(date: string) {
    onChange(date);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="flex items-center gap-1">
        {showDayShift && (
          <button
            type="button"
            onClick={() => onChange(shiftDays(value, -1))}
            aria-label="前一天"
            className="flex shrink-0 items-center justify-center rounded-md border border-zinc-300 p-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${ariaLabel}:${label}`}
          className="flex w-full min-w-0 items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-left text-sm text-zinc-900 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-500"
        >
          <CalendarDaysIcon className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
          <span className="truncate tabular-nums">{label}</span>
          {value === today && (
            <span className="ml-auto shrink-0 rounded-full bg-zinc-100 px-1.5 text-xs text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">
              今天
            </span>
          )}
        </button>
        {showDayShift && (
          <button
            type="button"
            onClick={() => onChange(shiftDays(value, 1))}
            aria-label="後一天"
            className="flex shrink-0 items-center justify-center rounded-md border border-zinc-300 p-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-30 mt-2 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shiftViewMonth(-1)} aria-label="上個月" className={NAV_BUTTON}>
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {viewYear} 年 {viewMon} 月
            </span>
            <button type="button" onClick={() => shiftViewMonth(1)} aria-label="下個月" className={NAV_BUTTON}>
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((w, i) => (
              <span
                key={w}
                className={`py-1 text-xs ${i === 0 || i === 6 ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400"}`}
              >
                {w}
              </span>
            ))}
            {cells.map((date, i) => {
              if (!date) return <span key={`empty-${i}`} />;
              const isSelected = date === value;
              const isToday = date === today;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => pick(date)}
                  aria-pressed={isSelected}
                  aria-label={date}
                  className={`flex h-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors ${
                    isSelected
                      ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : isToday
                        ? "font-medium text-zinc-900 ring-1 ring-inset ring-zinc-400 hover:bg-zinc-100 dark:text-zinc-50 dark:ring-zinc-500 dark:hover:bg-zinc-800"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {Number(date.slice(8))}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-end gap-1 border-t border-zinc-200 pt-2 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => pick(shiftDays(today, -1))}
              className="rounded-md px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              昨天
            </button>
            <button
              type="button"
              onClick={() => pick(today)}
              className="rounded-md px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              今天
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
