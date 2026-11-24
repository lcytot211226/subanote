"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { EMPTY_PATTERN, PALETTE, PATTERN_SIZE, PATTERN_TEMPLATES } from "@/lib/cardPattern";
import { PixelIcon } from "./CardIcon";

type Tool = "pen" | "eraser" | "fill" | "picker";

const TOOLS: { value: Tool; label: string }[] = [
  { value: "pen", label: "畫筆" },
  { value: "eraser", label: "橡皮擦" },
  { value: "fill", label: "油漆桶" },
  { value: "picker", label: "滴管" },
];

const HISTORY_LIMIT = 100;

/** 透明格子的棋盤格底,淺色 / 深色各一組 */
const CHECKER =
  "bg-[repeating-conic-gradient(#e4e4e7_0_25%,#ffffff_0_50%)] dark:bg-[repeating-conic-gradient(#3f3f46_0_25%,#27272a_0_50%)] bg-[length:50%_50%]";

function floodFill(pattern: string, index: number, color: string): string {
  const target = pattern[index];
  if (target === color) return pattern;
  const cells = [...pattern];
  const stack = [index];
  while (stack.length > 0) {
    const i = stack.pop()!;
    if (cells[i] !== target) continue;
    cells[i] = color;
    const x = i % PATTERN_SIZE;
    const y = Math.floor(i / PATTERN_SIZE);
    if (x > 0) stack.push(i - 1);
    if (x < PATTERN_SIZE - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - PATTERN_SIZE);
    if (y < PATTERN_SIZE - 1) stack.push(i + PATTERN_SIZE);
  }
  return cells.join("");
}

/**
 * 信用卡圖示的像素編輯器(16 × 16,16 色調色盤):上方模板一鍵套用(複製進來,之後可以繼續改),
 * 工具有畫筆 / 橡皮擦 / 油漆桶 / 滴管、復原 / 重做、清空。支援滑鼠與手指拖曳連續畫(touch-action: none,畫的時候頁面不捲動)。
 */
export default function PixelEditor({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("1");
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  // 拖曳中的筆畫:開始時記一次歷史,之後每格直接改
  const strokeRef = useRef<{ pattern: string } | null>(null);

  function commit(next: string) {
    if (next === value) return;
    setPast((p) => [...p, value].slice(-HISTORY_LIMIT));
    setFuture([]);
    onChange(next);
  }

  function undo() {
    if (past.length === 0) return;
    setFuture((f) => [value, ...f]);
    onChange(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  }

  function redo() {
    if (future.length === 0) return;
    setPast((p) => [...p, value]);
    onChange(future[0]);
    setFuture((f) => f.slice(1));
  }

  function cellAt(event: ReactPointerEvent) {
    const rect = gridRef.current!.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * PATTERN_SIZE);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * PATTERN_SIZE);
    if (x < 0 || y < 0 || x >= PATTERN_SIZE || y >= PATTERN_SIZE) return null;
    return y * PATTERN_SIZE + x;
  }

  function paint(index: number) {
    const stroke = strokeRef.current;
    if (!stroke) return;
    const ch = tool === "eraser" ? "0" : color;
    if (stroke.pattern[index] === ch) return;
    stroke.pattern = stroke.pattern.slice(0, index) + ch + stroke.pattern.slice(index + 1);
    onChange(stroke.pattern);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const index = cellAt(event);
    if (index == null) return;
    event.preventDefault();
    if (tool === "picker") {
      const picked = value[index];
      if (picked !== "0") setColor(picked);
      setTool("pen");
      return;
    }
    if (tool === "fill") {
      commit(floodFill(value, index, color));
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setPast((p) => [...p, value].slice(-HISTORY_LIMIT));
    setFuture([]);
    strokeRef.current = { pattern: value };
    paint(index);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!strokeRef.current) return;
    const index = cellAt(event);
    if (index != null) paint(index);
  }

  function endStroke() {
    const stroke = strokeRef.current;
    strokeRef.current = null;
    // 點了但完全沒改到任何格子:剛剛記的那筆歷史拿掉
    if (stroke && stroke.pattern === past[past.length - 1]) setPast((p) => p.slice(0, -1));
  }

  const buttonClass = (active: boolean) =>
    `rounded-md border px-2.5 py-1 text-sm font-medium transition-colors disabled:opacity-40 ${
      active
        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
        : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
    }`;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">模板(套用後可以繼續修改)</p>
        <div className="flex flex-wrap gap-1.5">
          {PATTERN_TEMPLATES.map((t) => (
            <button
              key={t.name}
              type="button"
              title={t.name}
              aria-label={`套用模板:${t.name}`}
              onClick={() => commit(t.pattern)}
              className="rounded-md border border-zinc-200 p-1 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
            >
              <PixelIcon pattern={t.pattern} className="h-7 w-7" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {TOOLS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTool(t.value)}
            aria-pressed={tool === t.value}
            className={buttonClass(tool === t.value)}
          >
            {t.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
        <button type="button" onClick={undo} disabled={past.length === 0} className={buttonClass(false)}>
          復原
        </button>
        <button type="button" onClick={redo} disabled={future.length === 0} className={buttonClass(false)}>
          重做
        </button>
        <button
          type="button"
          onClick={() => commit(EMPTY_PATTERN)}
          disabled={value === EMPTY_PATTERN}
          className={buttonClass(false)}
        >
          清空
        </button>
      </div>

      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="顏色">
        {PALETTE.slice(1).map((c, i) => {
          const ch = (i + 1).toString(16);
          const selected = color === ch && tool !== "eraser";
          return (
            <button
              key={ch}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`顏色 ${ch}`}
              onClick={() => {
                setColor(ch);
                if (tool === "eraser" || tool === "picker") setTool("pen");
              }}
              style={{ backgroundColor: c! }}
              className={`h-7 w-7 rounded-md border border-zinc-300 dark:border-zinc-600 ${
                selected ? "ring-2 ring-zinc-900 ring-offset-2 ring-offset-white dark:ring-zinc-100 dark:ring-offset-zinc-900" : ""
              }`}
            />
          );
        })}
      </div>

      <div className="flex items-end gap-4">
        <div
          ref={gridRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          role="img"
          aria-label="像素畫布"
          className={`grid aspect-square w-full max-w-[288px] touch-none select-none overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700 ${CHECKER} ${
            tool === "picker" ? "cursor-copy" : tool === "fill" ? "cursor-cell" : "cursor-crosshair"
          }`}
          style={{ gridTemplateColumns: `repeat(${PATTERN_SIZE}, minmax(0, 1fr))` }}
        >
          {[...value].map((ch, i) => (
            <div
              key={i}
              className="border-[0.5px] border-zinc-400/20"
              style={ch === "0" ? undefined : { backgroundColor: PALETTE[parseInt(ch, 16)]! }}
            />
          ))}
        </div>
        {/* 實際大小預覽 */}
        <div className="flex shrink-0 flex-col items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
          <PixelIcon pattern={value} className="h-4 w-4" />
          <PixelIcon pattern={value} className="h-6 w-6" />
          <PixelIcon pattern={value} className="h-9 w-9" />
          預覽
        </div>
      </div>
    </div>
  );
}
