"use client";

import { useState, type FormEvent } from "react";
import type { CardDTO } from "./CardForm";
import type { SubscriptionDTO } from "./SubscriptionsClient";
import { KindPicker } from "./KindPicker";
import Dropdown from "./Dropdown";
import DatePicker, { toDateString } from "./DatePicker";
import { cardOptions, paymentOption } from "./dropdownOptions";
import { expenseKindOf, type ExpenseKind } from "@/lib/expenseKind";

type SubscriptionCategory = "cash" | "credit_card";

function toDateInputValue(date: string) {
  return date.slice(0, 10);
}

export default function SubscriptionForm({
  cards,
  subscription,
  onSaved,
  onCancel,
  onDelete,
}: {
  cards: CardDTO[];
  subscription?: SubscriptionDTO;
  onSaved: () => void;
  onCancel: () => void;
  /** 有帶入時在按鈕列最右邊顯示「刪除」(僅編輯既有訂閱時使用),確認流程由外層處理。 */
  onDelete?: () => void;
}) {
  const [item, setItem] = useState(subscription?.item ?? "");
  const [kind, setKind] = useState<ExpenseKind>(subscription ? expenseKindOf(subscription) : "other");
  const [amount, setAmount] = useState(subscription ? String(subscription.amount) : "");
  const [category, setCategory] = useState<SubscriptionCategory>(subscription?.category ?? "cash");
  const [cardId, setCardId] = useState(subscription?.card?._id ?? cards[0]?._id ?? "");
  const [startDate, setStartDate] = useState(
    subscription ? toDateInputValue(subscription.startDate) : toDateString(new Date())
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    // 自製下拉選單沒有原生 required 驗證,這裡自己擋
    if (category === "credit_card" && !cardId) {
      setError("請選擇信用卡");
      return;
    }
    setSubmitting(true);

    const payload = {
      item,
      kind,
      amount: Number(amount),
      category,
      card: category === "cash" ? null : cardId,
      startDate,
    };

    const res = await fetch(subscription ? `/api/subscriptions/${subscription._id}` : "/api/subscriptions", {
      method: subscription ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "儲存失敗");
      return;
    }

    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">分類</label>
        <KindPicker value={kind} onChange={setKind} />
        {subscription && (
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">只套用在之後新生成的期數,已經記錄的支出不會跟著改</p>
        )}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">項目</label>
        <input
          required
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="例如:Netflix"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">每期金額</label>
        <input
          type="number"
          min={0}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">付款方式</label>
        <Dropdown
          fullWidth
          ariaLabel="付款方式"
          value={category}
          onChange={setCategory}
          options={[paymentOption("cash", "現金"), paymentOption("credit_card", "信用卡")]}
        />
      </div>
      {category === "credit_card" ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">信用卡</label>
          <Dropdown
            fullWidth
            ariaLabel="信用卡"
            placeholder="請選擇卡片"
            value={cardId}
            onChange={setCardId}
            options={cardOptions(cards)}
          />
        </div>
      ) : (
        <div />
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">首次扣款日</label>
        <DatePicker value={startDate} onChange={setStartDate} ariaLabel="首次扣款日" />
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          之後每月同一天(短月自動夾到月底)會自動補記一筆,不用手動輸入每期。
        </p>
      </div>

      {error && <p className="text-sm text-red-600 sm:col-span-2 dark:text-red-400">{error}</p>}

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {subscription ? "更新訂閱" : "新增訂閱"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
        >
          取消
        </button>
        {subscription && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={submitting}
            className="ml-auto rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
          >
            刪除
          </button>
        )}
      </div>
    </form>
  );
}
