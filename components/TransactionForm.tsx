"use client";

import { useRef, useState, type FormEvent } from "react";
import type { CardDTO } from "./CardForm";
import type { TransactionDTO } from "./TransactionsClient";
import { kindOf, type TransactionKind } from "@/lib/transactionKind";
import { KindPicker } from "./KindPicker";
import Dropdown from "./Dropdown";
import DatePicker, { toDateString } from "./DatePicker";
import { cardOptions, paymentOption } from "./dropdownOptions";

type TransactionCategory = "installment" | "cash" | "credit_card";

function toDateInputValue(date: string) {
  return date.slice(0, 10);
}

/**
 * API 回傳的交易:新增(POST)時 card 只是卡片 id、沒有 populate,編輯(PUT)時才是完整卡片。
 * 一律用手上的卡片清單補成 TransactionDTO,讓呼叫端直接更新本地列表、不用重打 API。
 */
type SavedTransaction = Omit<TransactionDTO, "card"> & { card: CardDTO | string | null };

function withCard(t: SavedTransaction, cards: CardDTO[]): TransactionDTO {
  const card = typeof t.card === "string" ? (cards.find((c) => c._id === t.card) ?? null) : t.card;
  return { ...t, card };
}

export default function TransactionForm({
  type,
  cards,
  transaction,
  onSaved,
  onAdded,
  onCancel,
  onDelete,
}: {
  type: "income" | "expense";
  cards: CardDTO[];
  transaction?: TransactionDTO;
  /** 編輯既有交易成功後呼叫(通常會關閉表單),帶入更新後的交易。 */
  onSaved: (transaction: TransactionDTO) => void;
  /** 新增交易成功後呼叫(表單會保持開啟,方便連續輸入多筆),帶入新建立的交易(分期會是整組每一期)。 */
  onAdded?: (transactions: TransactionDTO[]) => void;
  onCancel?: () => void;
  /** 有帶入時在按鈕列最右邊顯示「刪除」(僅編輯既有交易時使用),確認流程由外層處理。 */
  onDelete?: () => void;
}) {
  const itemInputRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(
    transaction ? toDateInputValue(transaction.date) : toDateString(new Date())
  );
  const [category, setCategory] = useState<TransactionCategory>(
    type === "income" ? "cash" : (transaction?.category ?? "cash")
  );
  const [item, setItem] = useState(transaction?.item ?? "");
  const [kind, setKind] = useState<TransactionKind>(transaction ? kindOf(transaction) : "other");
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [pointsDiscount, setPointsDiscount] = useState(
    transaction?.pointsDiscount ? String(transaction.pointsDiscount) : ""
  );
  const [totalAmount, setTotalAmount] = useState("");
  const [selectedCardId, setCardId] = useState(transaction?.card?._id ?? cards[0]?._id ?? "");
  // 快速記帳會先用快取的卡片清單開表單,最新清單回來後若原本選的卡已不存在就改選第一張
  const cardId =
    !selectedCardId || cards.some((c) => c._id === selectedCardId) ? selectedCardId : cards[0]?._id ?? "";
  const [totalNumber, setTotalNumber] = useState(
    transaction?.installmentInfo ? String(transaction.installmentInfo.totalNumber) : "2"
  );
  const [posted, setPosted] = useState(transaction?.posted ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 新增分期:一次輸入總金額+總期數,後端會自動生成每一期,而不是手動輸入單一一期的金額。
  const isCreatingInstallmentGroup = category === "installment" && !transaction;
  // 簽帳金融卡沒有結帳日,「結帳日當下已入帳」不適用
  const isDebitCard = category !== "cash" && !!cards.find((c) => c._id === cardId)?.isDebit;
  // 點數折抵只適用信用卡單筆支出
  const showPointsDiscount = type === "expense" && category === "credit_card";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    // 自製下拉選單沒有原生 required 驗證,這裡自己擋
    if (category !== "cash" && !cardId) {
      setError("請選擇信用卡");
      return;
    }
    setSubmitting(true);

    if (isCreatingInstallmentGroup) {
      const res = await fetch("/api/transactions/installment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item,
          kind,
          date,
          card: cardId,
          totalAmount: Number(totalAmount),
          totalNumber: Number(totalNumber),
        }),
      });
      const data = await res.json();

      setSubmitting(false);
      if (!res.ok) {
        setError(data.error ?? "儲存失敗");
        return;
      }

      setItem("");
      setTotalAmount("");
      itemInputRef.current?.focus();
      onAdded?.((data.transactions as SavedTransaction[]).map((t) => withCard(t, cards)));
      return;
    }

    const payload = {
      type,
      date,
      category,
      item,
      kind,
      amount: Number(amount),
      // 空字串 / 不適用都送 null,後端就不會存這個欄位(編輯時會移除)
      pointsDiscount: showPointsDiscount && pointsDiscount !== "" ? Number(pointsDiscount) : null,
      posted,
      card: category === "cash" ? null : cardId,
      installmentInfo:
        category === "installment" && transaction
          ? { currentNumber: transaction.installmentInfo?.currentNumber ?? 1, totalNumber: Number(totalNumber) }
          : null,
    };

    const res = await fetch(transaction ? `/api/transactions/${transaction._id}` : "/api/transactions", {
      method: transaction ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "儲存失敗");
      return;
    }

    const saved = withCard(data.transaction as SavedTransaction, cards);
    if (transaction) {
      onSaved(saved);
      return;
    }

    // 新增成功:保留日期/付款方式等設定,只清掉項目和金額,方便連續輸入下一筆。
    setItem("");
    setAmount("");
    setPointsDiscount("");
    itemInputRef.current?.focus();
    onAdded?.([saved]);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {isCreatingInstallmentGroup ? "第一期日期" : "日期"}
        </label>
        <DatePicker
          value={date}
          onChange={setDate}
          ariaLabel={isCreatingInstallmentGroup ? "第一期日期" : "日期"}
          showDayShift
        />
      </div>

      {type === "expense" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">付款方式</label>
          <Dropdown
            fullWidth
            ariaLabel="付款方式"
            value={category}
            onChange={setCategory}
            // 分期只能整組刪除重建,編輯時鎖住;單筆交易也不能改成分期
            disabled={!!transaction && transaction.category === "installment"}
            options={[
              paymentOption("cash", "現金"),
              paymentOption("credit_card", "信用卡(單筆)"),
              ...(!transaction || transaction.category === "installment"
                ? [paymentOption("installment", "分期")]
                : []),
            ]}
          />
        </div>
      )}
      {category !== "cash" ? (
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
      ) : type==="expense" && <div></div>}

      {/* 收入、支出都有分類(各自一組) */}
      <div className="sm:col-span-3">
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">分類</label>
        <KindPicker type={type} value={kind} onChange={setKind} />
        {transaction?.installmentGroupId && (
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">同一組分期的每一期會一起改</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">項目</label>
        <input
          ref={itemInputRef}
          required
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="例如:聚餐"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </div>

      {isCreatingInstallmentGroup ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">總金額</label>
          <input
            type="number"
            min={0}
            required
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {category === "installment" ? "這一期金額" : "金額"}
          </label>
          <input
            type="number"
            min={0}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
      )}

      {showPointsDiscount ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            點數折抵<span className="ml-1 text-xs font-normal text-zinc-400 dark:text-zinc-500">(選填)</span>
          </label>
          <input
            type="number"
            min={0}
            max={amount || undefined}
            value={pointsDiscount}
            onChange={(e) => setPointsDiscount(e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          {Number(pointsDiscount) > 0 && amount !== "" && (
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              實付 ${(Number(amount) - Number(pointsDiscount)).toLocaleString()}
            </p>
          )}
        </div>
      ) : (
        <div></div>
      )}

      {category === "installment" &&
        (isCreatingInstallmentGroup ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">總期數</label>
            <input
              type="number"
              min={1}
              required
              value={totalNumber}
              onChange={(e) => setTotalNumber(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              儲存後會自動建立 {totalNumber || "N"} 筆交易,每期各一筆。
            </p>
          </div>
        ) : (
          <div className="flex items-end">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              第 {transaction?.installmentInfo?.currentNumber} / {transaction?.installmentInfo?.totalNumber} 期
              (期數只能整組刪除重建,無法在此更改)
            </p>
          </div>
        ))}

      {category !== "cash" && !isCreatingInstallmentGroup && !isDebitCard && (
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={posted} onChange={(e) => setPosted(e.target.checked)} />
            結帳日當下已入帳
          </label>
        </div>
      )}

      {error && <p className="text-sm text-red-600 sm:col-span-3 dark:text-red-400">{error}</p>}

      <div className="flex gap-2 sm:col-span-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {transaction ? "更新交易" : isCreatingInstallmentGroup ? "建立分期" : "新增交易"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
          >
            取消
          </button>
        )}
        {transaction && onDelete && (
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
