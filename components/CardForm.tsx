"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import ConfirmDialog from "./ConfirmDialog";
import Modal from "./Modal";
import { CreditCardIcon, PlusIcon } from "./icons";
import CardIcon, { PixelIcon } from "./CardIcon";
import PixelEditor from "./PixelEditor";
import { EMPTY_PATTERN } from "@/lib/cardPattern";

export type CardDTO = {
  _id: string;
  name: string;
  /** 簽帳金融卡:沒有結帳日 / 繳款日,歸屬月份等同現金(舊資料沒有這個欄位視為 false) */
  isDebit?: boolean;
  closingDate: number | null;
  paymentDate: number | null;
  /** 自訂圖示(16 × 16 像素畫,lib/cardPattern.ts);沒有就用預設的信用卡圖示 */
  pattern?: string | null;
};

const emptyForm = { name: "", isDebit: false, closingDate: "", paymentDate: "", pattern: null as string | null };

const INPUT =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50";

/**
 * /cards 的「我的卡片」區塊:標題列右邊「+ 新增」開 dialog 新增卡片;點整張卡片開同一個 dialog 編輯,
 * 刪除在 dialog 按鈕列最右邊(同交易列表的操作方式)。
 */
export default function CardForm({ initialCards }: { initialCards: CardDTO[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CardDTO | null>(null);
  const [editingPattern, setEditingPattern] = useState(false);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setEditingPattern(false);
    setOpen(true);
  }

  function openEdit(card: CardDTO) {
    setEditingId(card._id);
    setForm({
      name: card.name,
      isDebit: !!card.isDebit,
      closingDate: card.closingDate != null ? String(card.closingDate) : "",
      paymentDate: card.paymentDate != null ? String(card.paymentDate) : "",
      pattern: card.pattern ?? null,
    });
    setError(null);
    setEditingPattern(false);
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    // pattern 為 null(或整張透明)時後端會移除圖示,回到預設圖示
    const payload = form.isDebit
      ? { name: form.name, isDebit: true, pattern: form.pattern }
      : {
          name: form.name,
          isDebit: false,
          closingDate: Number(form.closingDate),
          paymentDate: Number(form.paymentDate),
          pattern: form.pattern,
        };

    const res = await fetch(editingId ? `/api/cards/${editingId}` : "/api/cards", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "儲存失敗");
      return;
    }

    close();
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/cards/${deleteTarget._id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (!res.ok) return;
    close();
    router.refresh();
  }

  const editingCard = initialCards.find((c) => c._id === editingId) ?? null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-50">
          <CreditCardIcon className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
          我的卡片
        </h2>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <PlusIcon className="h-4 w-4" />
          新增
        </button>
      </div>

      {initialCards.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
          尚未新增任何信用卡
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {initialCards.map((card) => (
            <li
              key={card._id}
              role="button"
              tabIndex={0}
              onClick={() => openEdit(card)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openEdit(card);
                }
              }}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/60"
            >
              {/* 有自訂像素圖示就直接畫;否則是圓底的預設圖示,簽帳金融卡用紫色區分,同 /overview */}
              {card.pattern ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center">
                  <PixelIcon pattern={card.pattern} className="h-8 w-8" />
                </span>
              ) : (
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    card.isDebit
                      ? "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  <CreditCardIcon className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">{card.name}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {card.isDebit ? "簽帳金融卡" : `結帳日 ${card.closingDate} 號 · 繳款日 ${card.paymentDate} 號`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={close} title={editingId ? "編輯卡片" : "新增卡片"} size="sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">卡片名稱</label>
            <input
              required
              autoFocus={!editingId}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例如:國泰CUBE卡"
              className={INPUT}
            />
          </div>

          {!form.isDebit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">結帳日</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  required
                  value={form.closingDate}
                  onChange={(e) => setForm({ ...form, closingDate: e.target.value })}
                  placeholder="幾號"
                  className={INPUT}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">繳款日</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  required
                  value={form.paymentDate}
                  onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                  placeholder="幾號"
                  className={INPUT}
                />
              </div>
            </div>
          )}

          {/* 卡片類型只能在新增時決定,編輯時鎖住 */}
          <label
            className={`flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300 ${editingId ? "opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.isDebit}
              disabled={!!editingId}
              onChange={(e) => setForm({ ...form, isDebit: e.target.checked })}
            />
            <span>
              簽帳金融卡
              <span className="block text-xs text-zinc-400 dark:text-zinc-500">
                {editingId
                  ? "卡片類型新增後無法更改"
                  : "直接從帳戶扣款,沒有結帳日,依消費日期當月計算,同現金;新增後無法更改"}
              </span>
            </span>
          </label>

          {/* 自訂圖示:16 × 16 像素畫,用在總覽、收支列表、下拉選單等顯示卡片的地方 */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">圖示</span>
              <span className="flex h-6 w-6 items-center justify-center">
                <CardIcon card={{ isDebit: form.isDebit, pattern: form.pattern }} className="h-5 w-5" />
              </span>
              <div className="ml-auto flex gap-2">
                {form.pattern && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, pattern: null });
                      setEditingPattern(false);
                    }}
                    className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    使用預設
                  </button>
                )}
                {!editingPattern && (
                  <button
                    type="button"
                    onClick={() => setEditingPattern(true)}
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {form.pattern ? "編輯圖示" : "自訂圖示"}
                  </button>
                )}
              </div>
            </div>
            {editingPattern && (
              <div className="mt-3">
                <PixelEditor
                  value={form.pattern ?? EMPTY_PATTERN}
                  onChange={(next) => setForm((f) => ({ ...f, pattern: next === EMPTY_PATTERN ? null : next }))}
                />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {editingId ? "更新卡片" : "新增卡片"}
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
            >
              取消
            </button>
            {editingCard && (
              <button
                type="button"
                onClick={() => setDeleteTarget(editingCard)}
                disabled={submitting}
                className="ml-auto rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
              >
                刪除
              </button>
            )}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="刪除確認"
        message={`確定要刪除「${deleteTarget?.name ?? ""}」這張卡片嗎?`}
        confirmLabel="刪除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
