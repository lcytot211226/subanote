"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { useDismiss } from "@/lib/useDismiss";
import { ArrowDownIcon } from "./icons";

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
  /** 選項前面的小圖示(建議用 IconBadge 或 KindIcon size="sm") */
  icon?: ReactNode;
  disabled?: boolean;
};

/** 下拉選單選項用的中性小圓底圖示;tone 可換顏色(例如簽帳金融卡用紫色)。 */
export function IconBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "violet" }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full [&>svg]:h-4 [&>svg]:w-4 ${
        tone === "violet"
          ? "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * 取代原生 <select> 的下拉選單:選項可以帶圖示,外觀在淺色 / 深色模式一致。
 * 支援鍵盤:按鈕上 ↑↓ / Enter / 空白鍵打開,選單內 ↑↓ 移動、Enter 選取、Esc 關閉;點外面也會關閉。
 */
export default function Dropdown<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = "請選擇",
  fullWidth = false,
  disabled = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  ariaLabel: string;
  /** value 對不到任何選項時顯示的文字 */
  placeholder?: string;
  /** 表單裡用:按鈕撐滿寬度、選單跟按鈕同寬 */
  fullWidth?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  useDismiss(rootRef, open, () => setOpen(false));

  function openMenu() {
    if (disabled) return;
    setHighlight(selectedIndex >= 0 ? selectedIndex : options.findIndex((o) => !o.disabled));
    setOpen(true);
  }

  function choose(option: DropdownOption<T>) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function move(step: 1 | -1) {
    if (options.length === 0) return;
    let i = highlight;
    for (let n = 0; n < options.length; n++) {
      i = (i + step + options.length) % options.length;
      if (!options[i].disabled) break;
    }
    setHighlight(i);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (options[highlight]) choose(options[highlight]);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${fullWidth ? "w-full" : ""}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={`flex items-center gap-2 rounded-md border border-zinc-300 py-1.5 pl-2 pr-2.5 text-left text-sm text-zinc-900 transition-colors hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-500 ${
          fullWidth ? "w-full" : ""
        }`}
      >
        {selected?.icon}
        <span className={`truncate ${fullWidth ? "flex-1" : ""} ${selected ? "" : "text-zinc-400"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ArrowDownIcon
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 ${
            fullWidth ? "w-full" : "min-w-full w-max max-w-[16rem]"
          }`}
        >
          {options.map((option, i) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value || "__empty"}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                onPointerEnter={() => setHighlight(i)}
                onClick={() => choose(option)}
                className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm ${
                  option.disabled
                    ? "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
                    : isSelected
                      ? "font-medium text-zinc-900 dark:text-zinc-50"
                      : "text-zinc-700 dark:text-zinc-300"
                } ${highlight === i && !option.disabled ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
              >
                {option.icon}
                <span className="truncate">{option.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
