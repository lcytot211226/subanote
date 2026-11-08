"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import Switch from "./Switch";
import type { IncomingShare } from "@/lib/sharedTransactions";
import { UserGroupIcon } from "./icons";

type OutgoingShareDTO = { _id: string; targetEmail: string };

function money(n: number) {
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString()}`;
}

/** email 開頭字母的圓形頭像,讓清單比較好掃 */
function Avatar({ email }: { email: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold uppercase text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
      {email.charAt(0)}
    </span>
  );
}

/** 分享出去的內容對照(跟 lib/getIncomingShares.ts 實際回傳的欄位一致,改那邊要一起改這裡) */
const SHARED_FIELDS = [
  "你的 email",
  "每月收入、支出總額",
  "每筆交易的日期、收入 / 支出、分類、金額(已扣點數折抵)",
  "付款方式(現金 / 信用卡 / 分期)與是否為訂閱",
  "房租水電:帳單日、租金、電費 / 水費(含度數與單價)、是否計入統計",
];

const PRIVATE_FIELDS = [
  "交易的品項名稱",
  "信用卡名稱與用哪張卡",
  "分期第幾期 / 共幾期、點數折抵金額",
  "訂閱清單本身、信用卡對帳 / 繳費狀態、房租水電繳費狀態",
  "回饋試算、月結算日、你分享給其他人的對象",
];

function ScopeList({ title, items, tone }: { title: string; items: string[]; tone: "share" | "private" }) {
  const mark = tone === "share" ? "✓" : "✕";
  const markColor = tone === "share" ? "text-indigo-500 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-500";
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">{title}</p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
            <span aria-hidden="true" className={`shrink-0 ${markColor}`}>
              {mark}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 分享前清楚列出哪些會給對方、哪些保密 */
function SharingScope() {
  return (
    <div className="mb-3 flex flex-col gap-3 rounded-md bg-zinc-50 p-3 sm:flex-row sm:gap-4 dark:bg-zinc-800/60">
      <ScopeList title="對方看得到" items={SHARED_FIELDS} tone="share" />
      <ScopeList title="保密(對方看不到)" items={PRIVATE_FIELDS} tone="private" />
    </div>
  );
}

/**
 * /overview 的共享參考表:外面只是一列入口(標題 + 人數摘要 + 「編輯」),
 * 所有操作都在 dialog 裡——別人分享給我的資料(本月收支 + 納入收支開關,切換直接送出)、
 * 我分享給誰(上方直接輸入 email 新增,清單逐一取消分享)。
 */
export default function SharedItemsSection({
  incomingItems,
  loading,
  onIncomingChanged,
}: {
  incomingItems: IncomingShare[];
  loading: boolean;
  /** 我(收件人)切換某份分享是否納入收支後呼叫,帶入更新後的清單,外層直接更新本地狀態、不重新載入總覽。 */
  onIncomingChanged: (items: IncomingShare[]) => void;
}) {
  const [outgoingShares, setOutgoingShares] = useState<OutgoingShareDTO[]>([]);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OutgoingShareDTO | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const loadOutgoing = useCallback(async () => {
    const res = await fetch("/api/shares");
    const data = await res.json().catch(() => ({}));
    setOutgoingShares(data.shares ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOutgoing();
  }, [loadOutgoing]);

  function close() {
    setOpen(false);
    setEmail("");
    setAddError(null);
  }

  async function addShare(event: FormEvent) {
    event.preventDefault();
    const target = email.trim();
    if (!target) return;
    setAdding(true);
    setAddError(null);
    const res = await fetch("/api/shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetEmail: target }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setAdding(false);
    if (!res?.ok) {
      setAddError(data.error ?? "分享失敗");
      return;
    }
    setEmail("");
    await loadOutgoing();
  }

  async function confirmDeleteOutgoing() {
    if (!deleteTarget) return;
    await fetch(`/api/shares/${deleteTarget._id}`, { method: "DELETE" });
    setDeleteTarget(null);
    await loadOutgoing();
  }

  /** 一個分享者只有一個「納入收支」開關,切換直接送出;失敗就維持原狀。 */
  async function toggleIncluded(share: IncomingShare) {
    setSavingId(share._id);
    const included = !share.included;
    const ok = await fetch(`/api/shares/${share._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ included }),
    })
      .then((res) => res.ok)
      .catch(() => false);
    setSavingId(null);
    if (ok) onIncomingChanged(incomingItems.map((s) => (s._id === share._id ? { ...s, included } : s)));
  }

  const incomingCount = incomingItems.length;
  const outgoingCount = outgoingShares.length;
  const summary =
    incomingCount === 0 && outgoingCount === 0
      ? "尚未共享"
      : [incomingCount > 0 && `${incomingCount} 人分享給我`, outgoingCount > 0 && `分享給 ${outgoingCount} 人`]
          .filter(Boolean)
          .join(" · ");

  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white p-4 transition-opacity dark:border-zinc-800 dark:bg-zinc-900 ${loading ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 whitespace-nowrap font-medium text-zinc-900 dark:text-zinc-50">
          <UserGroupIcon className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
          共享參考表
        </h2>
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-sm text-zinc-400 dark:text-zinc-500">{summary}</span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-0.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            編輯
          </button>
        </div>
      </div>

      <Modal open={open} onClose={close} title="共享參考表">
        <div className="flex flex-col gap-6">
          <section>
            <h3 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">別人分享給我</h3>
            {incomingItems.length === 0 ? (
              <p className="rounded-md bg-zinc-50 px-3 py-4 text-center text-sm text-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-500">
                目前沒有人跟你分享
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {incomingItems.map((share) => (
                  <li key={share._id} className="flex items-center gap-3 px-3 py-2.5">
                    <Avatar email={share.ownerEmail} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{share.ownerEmail}</p>
                      <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                        本月收入 {money(share.income)} · 支出 {money(share.expense)}
                      </p>
                    </div>
                    <Switch
                      label="納入"
                      checked={share.included}
                      disabled={savingId === share._id}
                      onChange={() => toggleIncluded(share)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">我分享給</h3>
            <SharingScope />
            <form onSubmit={addShare} className="mb-3 flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setAddError(null);
                }}
                placeholder="輸入對方的 email"
                className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
              <button
                type="submit"
                disabled={adding || !email.trim()}
                className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {adding ? "分享中…" : "分享"}
              </button>
            </form>
            {addError && <p className="-mt-1 mb-3 text-sm text-red-600 dark:text-red-400">{addError}</p>}
            {outgoingShares.length === 0 ? (
              <p className="rounded-md bg-zinc-50 px-3 py-4 text-center text-sm text-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-500">
                還沒有分享給任何人
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {outgoingShares.map((share) => (
                  <li key={share._id} className="flex items-center gap-3 px-3 py-2.5">
                    <Avatar email={share.targetEmail} />
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                      {share.targetEmail}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(share)}
                      className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                    >
                      取消分享
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="取消分享"
        message={`確定要停止分享給 ${deleteTarget?.targetEmail ?? ""} 嗎?對方將不再看得到你的收支。`}
        confirmLabel="取消分享"
        onConfirm={confirmDeleteOutgoing}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
