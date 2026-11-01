"use client";

import Link from "next/link";
import { useState } from "react";
import { netAmount } from "@/lib/pointsDiscount";
import { KIND_LABEL, kindOf, kindsFor, type TransactionKind, type TransactionType } from "@/lib/transactionKind";
import KindIcon, { KIND_FILL } from "./KindIcon";
import { TagIcon } from "./icons";
import type { TransactionDTO } from "./TransactionsClient";

type Row = { kind: TransactionKind; amount: number; ratio: number };

const TYPE_LABEL: Record<TransactionType, string> = { expense: "支出", income: "收入" };

/** 這個月某一類(收入 / 支出)交易依分類加總,金額由多到少,只留有金額的分類。 */
function breakdown(transactions: TransactionDTO[], type: TransactionType) {
  const sums = new Map<TransactionKind, number>();
  for (const t of transactions) {
    if (t.type !== type) continue;
    const kind = kindOf(t);
    sums.set(kind, (sums.get(kind) ?? 0) + netAmount(t));
  }
  const total = [...sums.values()].reduce((a, b) => a + b, 0);
  const rows: Row[] = kindsFor(type)
    .map((kind) => ({ kind, amount: sums.get(kind) ?? 0, ratio: total > 0 ? (sums.get(kind) ?? 0) / total : 0 }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return { rows, total };
}

/** 簡單的圓環:每個分類一段弧,顏色同分類圖示;中間顯示總額。 */
function Donut({ rows, total, label }: { rows: Row[]; total: number; label: string }) {
  const r = 40;
  const circumference = 2 * Math.PI * r;
  // 每段弧從前面所有分類累計的長度開始畫
  const segments = rows.map((row, i) => ({
    kind: row.kind,
    length: row.ratio * circumference,
    offset: rows.slice(0, i).reduce((sum, r) => sum + r.ratio * circumference, 0),
  }));
  return (
    <div className="relative h-28 w-28 shrink-0 sm:h-40 sm:w-40">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="12" className="stroke-zinc-100 dark:stroke-zinc-800" />
        {segments.map((seg) => (
          <circle
            key={seg.kind}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="12"
            strokeDasharray={`${seg.length} ${circumference - seg.length}`}
            strokeDashoffset={-seg.offset}
            className={KIND_FILL[seg.kind].stroke}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
        <span className="text-[10px] text-zinc-500 sm:text-xs dark:text-zinc-400">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-zinc-900 sm:text-base dark:text-zinc-50">
          ${total.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function Panel({ type, transactions, period }: { type: TransactionType; transactions: TransactionDTO[]; period: string }) {
  const { rows, total } = breakdown(transactions, type);
  const label = TYPE_LABEL[type];

  if (rows.length === 0) {
    return (
      <p className="flex h-full items-center justify-center py-6 text-sm text-zinc-400 dark:text-zinc-500">
        本月無{label}資料
      </p>
    );
  }

  return (
    // h-full:撐滿兩邊共用的高度再置中,圓環在收入 / 支出兩邊的位置才會一樣,切換時不會跳動
    <div className="flex h-full items-center gap-4 sm:gap-8">
      <Donut rows={rows} total={total} label={label} />
      <ul className="flex min-w-0 flex-1 flex-col gap-1">
        {rows.map((row) => (
          <li key={row.kind}>
            {/* 點一列直接看這個分類這個月的明細 */}
            <Link
              href={`/${type}?period=${period}&kind=${row.kind}`}
              className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <KindIcon kind={row.kind} size="sm" />
              <span className="w-8 shrink-0 text-zinc-700 dark:text-zinc-300">{KIND_LABEL[row.kind]}</span>
              <span className="h-2 min-w-6 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <span
                  className={`block h-full rounded-full ${KIND_FILL[row.kind].bar}`}
                  style={{ width: `${Math.max(row.ratio * 100, 2)}%` }}
                />
              </span>
              <span className="shrink-0 text-right tabular-nums text-zinc-900 dark:text-zinc-50">
                ${row.amount.toLocaleString()}
              </span>
              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {Math.round(row.ratio * 100)}%
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * /overview「每日支出」下方的分類統計:依交易分類(lib/transactionKind.ts)加總本月收入 / 支出,
 * 每邊一個簡單圓環 + 由多到少的橫條列表,點一列導到 /expense 或 /income 並帶入該分類篩選。
 * 用右上角「支出 / 收入」切換(預設支出),一次只顯示一邊,圓環才有空間放大;
 * 兩邊疊在同一格,高度取較高的那邊,切換時卡片高度不變。
 * 只統計交易紀錄(用前端已經抓回來的當月交易現場算),不含房租水電、自訂項目與共享項目。
 */
export default function CategoryBreakdown({
  transactions,
  period,
  loading,
}: {
  transactions: TransactionDTO[];
  period: string;
  loading: boolean;
}) {
  const [type, setType] = useState<TransactionType>("expense");

  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white p-4 transition-opacity dark:border-zinc-800 dark:bg-zinc-900 ${loading ? "opacity-60" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-50">
          <TagIcon className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          {period} 分類統計
        </h2>
        <div
          role="group"
          aria-label="支出或收入"
          className="grid grid-cols-2 gap-0.5 rounded-md border border-zinc-300 p-0.5 text-xs dark:border-zinc-700"
        >
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={`rounded px-2.5 py-1 font-medium ${
                type === t
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-300"
              }`}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* 兩邊都畫出來、疊在同一格:沒選的那邊只是隱形但仍佔位,高度固定取兩者較高的,切換時卡片不會忽長忽短 */}
      <div className="grid">
        {(["expense", "income"] as const).map((t) => (
          <div
            key={t}
            aria-hidden={type !== t}
            inert={type !== t}
            className={`col-start-1 row-start-1 ${type === t ? "" : "invisible"}`}
          >
            <Panel type={t} transactions={transactions} period={period} />
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">只統計交易紀錄,不含房租水電與自訂項目</p>
    </div>
  );
}
