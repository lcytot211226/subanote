"use client";

import { useState } from "react";
import type { CardDTO } from "./CardForm";
import SubscriptionForm from "./SubscriptionForm";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import { ArrowPathIcon, PlusIcon } from "./icons";
import KindIcon from "./KindIcon";
import { expenseKindOf, type ExpenseKind } from "@/lib/expenseKind";

export type SubscriptionDTO = {
  _id: string;
  item: string;
  /** 支出分類,之後生成的每一期交易都沿用;舊資料沒有時視為「其他」(expenseKindOf) */
  kind?: ExpenseKind | null;
  amount: number;
  category: "cash" | "credit_card";
  card: CardDTO | null;
  startDate: string;
  lastGeneratedDate: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 下一次扣款日(本地日期,當天 00:00)。startDate 存的是 UTC 午夜、代表當地行事曆上的那一天,
 * 所以直接取 "YYYY-MM-DD" 的年月日;每月同一天,短月夾到月底(同 addMonthsClamped)。
 * 還沒開始的訂閱,下一次就是首次扣款日。
 */
function nextChargeDate(startDate: string, today: Date): Date {
  const [y, m, d] = startDate.slice(0, 10).split("-").map(Number);
  const start = new Date(y, m - 1, d);
  if (start >= today) return start;
  for (let offset = 0; ; offset++) {
    const year = today.getFullYear();
    const month = today.getMonth() + offset;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const candidate = new Date(year, month, Math.min(d, lastDay));
    if (candidate >= today) return candidate;
  }
}

function relativeDays(date: Date, today: Date) {
  const days = Math.round((date.getTime() - today.getTime()) / DAY_MS);
  if (days === 0) return "今天";
  if (days === 1) return "明天";
  return `${days} 天後`;
}

/**
 * /expense 篩選列旁的「訂閱」按鈕 + 所有訂閱清單(依下次扣款日排序,點一筆打開編輯,刪除在編輯表單裡)。
 * 訂閱清單由外層(ExpenseClient)持有;新增訂閱主要走右下角浮動「+」的「訂閱」分頁,清單底部也有入口。
 */
export default function SubscriptionsClient({
  cards,
  subscriptions,
  onChanged,
}: {
  cards: CardDTO[];
  subscriptions: SubscriptionDTO[];
  /** 新增/編輯/刪除訂閱後呼叫,由外層重新讀取訂閱與交易列表(可能有新生成的訂閱交易)。 */
  onChanged: () => Promise<void> | void;
}) {
  const [showList, setShowList] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SubscriptionDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionDTO | null>(null);

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  async function handleSaved() {
    closeForm();
    await onChanged();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/subscriptions/${deleteTarget._id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (!res.ok) return;
    closeForm();
    await onChanged();
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rows = subscriptions
    .map((sub) => ({ sub, next: nextChargeDate(sub.startDate, today) }))
    .sort((a, b) => a.next.getTime() - b.next.getTime() || a.sub.item.localeCompare(b.sub.item));
  const monthlyTotal = subscriptions.reduce((sum, s) => sum + s.amount, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowList(true)}
        className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <ArrowPathIcon className="h-4 w-4" />
        訂閱
        {subscriptions.length > 0 && (
          <span className="rounded-full bg-zinc-200 px-1.5 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
            {subscriptions.length}
          </span>
        )}
      </button>

      <Modal open={showList} onClose={() => setShowList(false)} title="所有訂閱">
        <div className="flex flex-col gap-4">
          {subscriptions.length > 0 && (
            <div className="flex items-end justify-between rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">每月訂閱合計</p>
                <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">${monthlyTotal.toLocaleString()}</p>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">共 {subscriptions.length} 個</p>
            </div>
          )}

          {subscriptions.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              還沒有訂閱項目,新增後每個月會自動補記一筆支出,不用手動輸入。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map(({ sub, next }) => (
                <li
                  key={sub._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditing(sub)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditing(sub);
                    }
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 p-3 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/60"
                >
                  <KindIcon kind={expenseKindOf(sub)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">{sub.item}</p>
                    <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                      每月 {Number(sub.startDate.slice(8, 10))} 號 ·{" "}
                      {sub.category === "cash" ? "現金" : (sub.card?.name ?? "信用卡")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">${sub.amount.toLocaleString()}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      下次 {next.getMonth() + 1}/{next.getDate()}({relativeDays(next, today)})
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
          >
            <PlusIcon className="h-4 w-4" />
            新增訂閱
          </button>
        </div>
      </Modal>

      <Modal open={showForm || !!editing} onClose={closeForm} title={editing ? "編輯訂閱" : "新增訂閱"}>
        <SubscriptionForm
          key={editing ? editing._id : "new"}
          cards={cards}
          subscription={editing ?? undefined}
          onSaved={handleSaved}
          onCancel={closeForm}
          onDelete={editing ? () => setDeleteTarget(editing) : undefined}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="刪除確認"
        message={`確定要刪除「${deleteTarget?.item ?? ""}」這個訂閱嗎?已經記錄過的支出不會被刪除,只是之後不再自動生成。`}
        confirmLabel="刪除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
