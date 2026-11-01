"use client";

import { useState, type FormEvent } from "react";
import Modal from "./Modal";
import { PlusIcon, TagIcon } from "./icons";

export type CustomItemDTO = {
  _id: string;
  name: string;
  amount: number;
  /** 日期(DD),選填 */
  date?: number | null;
};

/** 有日期的依日期排,沒日期的排在最後(維持建立順序) */
function byDate(a: CustomItemDTO, b: CustomItemDTO) {
  return (a.date ?? 99) - (b.date ?? 99);
}

/** 日期輸入框的字串 → API 要的值(空字串 = 沒填) */
function toDatePayload(value: string) {
  return value.trim() === "" ? null : Number(value);
}

export default function CustomItemsEditor({
  year,
  month,
  items,
  loading,
  onSaved,
}: {
  year: number;
  month: number;
  items: CustomItemDTO[];
  loading: boolean;
  /** 新增 / 編輯 / 刪除成功後帶入更新後的整份清單,外層直接更新本地狀態,不重新載入整個總覽。 */
  onSaved: (items: CustomItemDTO[]) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    setAddError(null);

    const res = await fetch("/api/custom-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year,
        month,
        name: name.trim(),
        amount: Number(amount) || 0,
        date: toDatePayload(date),
      }),
    });
    const data = await res.json();

    setAdding(false);
    if (!res.ok) {
      setAddError(data.error ?? "新增失敗");
      return;
    }
    closeAdd();
    onSaved([...items, data.item]);
  }

  function openAdd() {
    setName("");
    setAmount("");
    setDate("");
    setAddError(null);
    setShowAdd(true);
  }

  function closeAdd() {
    setShowAdd(false);
  }

  function startEdit(item: CustomItemDTO) {
    setEditingId(item._id);
    setEditName(item.name);
    setEditAmount(String(item.amount));
    setEditDate(item.date ? String(item.date) : "");
  }

  async function handleEditSave(id: string) {
    if (!editName.trim()) return;
    setSavingEdit(true);
    setError(null);

    const res = await fetch(`/api/custom-items/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), amount: Number(editAmount) || 0, date: toDatePayload(editDate) }),
    });
    const data = await res.json();

    setSavingEdit(false);
    if (!res.ok) {
      setError(data.error ?? "更新失敗");
      return;
    }
    setEditingId(null);
    onSaved(items.map((item) => (item._id === id ? data.item : item)));
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/custom-items/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) onSaved(items.filter((item) => item._id !== id));
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const daysInMonth = new Date(year, month, 0).getDate();
  const sortedItems = [...items].sort(byDate);

  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white p-4 transition-opacity dark:border-zinc-800 dark:bg-zinc-900 ${loading ? "opacity-60" : ""}`}
    >
      {/* 空的時候整塊收成這一行(淡色「本月無資料」+「新增」),有項目才往下展開列表 */}
      <div className={`flex items-center justify-between gap-2 ${items.length > 0 ? "mb-3" : ""}`}>
        {/* 圖示跟總覽「其他」區塊的自訂項目格子一致,大小顏色同上方房租水電費的標題 */}
        <div className="flex min-w-0 items-center gap-2">
          <TagIcon className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
          <h2 className="whitespace-nowrap font-medium text-zinc-900 dark:text-zinc-50">自訂項目</h2>
        </div>
        <div className="flex items-center gap-3">
          {items.length > 0
            ? total > 0 && (
                <span className="text-sm text-zinc-500 dark:text-zinc-400">合計 ${total.toLocaleString()}</span>
              )
            : !loading && <span className="text-sm text-zinc-400 dark:text-zinc-500">本月無資料</span>}
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            <PlusIcon className="h-4 w-4" />
            新增
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {sortedItems.map((item) =>
            editingId === item._id ? (
              <li key={item._id} className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={daysInMonth}
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  placeholder="日"
                  aria-label="日期(幾號)"
                  className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <input
                  type="number"
                  min={0}
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => handleEditSave(item._id)}
                  className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  儲存
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                >
                  取消
                </button>
              </li>
            ) : (
              <li
                key={item._id}
                className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {item.date ? (
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs tabular-nums text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {month}/{item.date}
                    </span>
                  ) : null}
                  <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">{item.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">${item.amount.toLocaleString()}</span>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="text-xs text-zinc-500 hover:underline dark:text-zinc-400"
                  >
                    編輯
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === item._id}
                    onClick={() => handleDelete(item._id)}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                  >
                    刪除
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}

      <Modal open={showAdd} onClose={closeAdd} title={`新增 ${month} 月自訂項目`} size="sm">
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">項目名稱</label>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如 孝親費"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">金額</label>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                日期<span className="ml-1 text-xs font-normal text-zinc-400 dark:text-zinc-500">(選填)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={daysInMonth}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="幾號"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <span className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">號</span>
              </div>
            </div>
          </div>

          {addError && <p className="text-sm text-red-600 dark:text-red-400">{addError}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding || !name.trim()}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {adding ? "新增中..." : "新增"}
            </button>
            <button
              type="button"
              onClick={closeAdd}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
            >
              取消
            </button>
          </div>
        </form>
      </Modal>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
