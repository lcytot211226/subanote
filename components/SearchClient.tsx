"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MonthPicker from "./MonthPicker";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import TransactionForm from "./TransactionForm";
import type { CardDTO } from "./CardForm";
import KindIcon from "./KindIcon";
import { PixelIcon } from "./CardIcon";
import type { TransactionDTO } from "./TransactionsClient";
import { shiftPeriod } from "@/lib/period";
import { kindOf } from "@/lib/transactionKind";
import { netAmount } from "@/lib/pointsDiscount";
import { escapeRegExp, parseKeywords } from "@/lib/searchKeywords";

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const CATEGORY_LABEL: Record<TransactionDTO["category"], string> = {
  cash: "現金",
  credit_card: "信用卡",
  installment: "分期",
};

type TypeFilter = "all" | "expense" | "income";

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "expense", label: "支出" },
  { value: "income", label: "收入" },
];

type Result = { query: string; from: string; to: string; transactions: TransactionDTO[]; truncated: boolean };

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** 快速選區間:都以這個月為基準 */
function presets(): { label: string; from: string; to: string }[] {
  const now = currentPeriod();
  const year = now.slice(0, 4);
  const lastYear = String(Number(year) - 1);
  return [
    { label: "近一年", from: shiftPeriod(now, -11), to: now },
    { label: "今年", from: `${year}-01`, to: now },
    { label: "去年", from: `${lastYear}-01`, to: `${lastYear}-12` },
    { label: "近三年", from: shiftPeriod(now, -35), to: now },
  ];
}

function money(n: number) {
  return `$${n.toLocaleString()}`;
}

function monthLabel(period: string) {
  return `${period.slice(0, 4)} 年 ${Number(period.slice(5))} 月`;
}

/** 品名裡符合關鍵字的部分加上底色 */
function Highlighted({ text, keywords }: { text: string; keywords: string[] }) {
  if (keywords.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${keywords.map(escapeRegExp).join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-amber-200/70 text-inherit dark:bg-amber-500/30">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * /search:依品名搜尋一段月份區間(依 billingPeriod,預設近一年)內的所有收支。
 * 關鍵字是品名的子字串就符合,可用逗號分隔多個(符合任一個)。搜尋條件會寫回網址,
 * 重新整理或從別頁按上一頁回來會回到同樣的搜尋結果。
 * 點一筆結果直接在這裡開編輯 dialog(同 /income、/expense 的 TransactionForm),存檔 / 刪除後就地更新結果。
 */
export default function SearchClient({ cards }: { cards: CardDTO[] }) {
  const searchParams = useSearchParams();
  const [initial] = useState(() => {
    const now = currentPeriod();
    const rawFrom = searchParams.get("from") ?? "";
    const rawTo = searchParams.get("to") ?? "";
    const valid = PERIOD_RE.test(rawFrom) && PERIOD_RE.test(rawTo) && rawFrom <= rawTo;
    return {
      q: searchParams.get("q") ?? "",
      from: valid ? rawFrom : shiftPeriod(now, -11),
      to: valid ? rawTo : now,
    };
  });
  const [input, setInput] = useState(initial.q);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [result, setResult] = useState<Result | null>(null);
  // 網址帶了關鍵字(例如從結果點進去再按上一頁)就一進頁面直接搜尋
  const [loading, setLoading] = useState(() => parseKeywords(initial.q).length > 0);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const [editing, setEditing] = useState<TransactionDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionDTO | null>(null);

  /**
   * 打搜尋 API,回傳要套用的結果(不在這裡 setState,讓 effect 也能用 .then 套用)。
   * 只有最後一次送出的請求會回傳結果,舊的請求晚回來就丟掉(回傳 null)。
   */
  const request = useCallback(async (query: string, rangeFrom: string, rangeTo: string) => {
    const id = ++requestId.current;
    const params = new URLSearchParams({ q: query, from: rangeFrom, to: rangeTo });
    window.history.replaceState(null, "", `/search?${params}`);
    let outcome: { result: Result } | { error: string };
    try {
      const res = await fetch(`/api/transactions/search?${params}`);
      const json = await res.json();
      outcome = res.ok
        ? { result: { query, from: rangeFrom, to: rangeTo, transactions: json.transactions, truncated: json.truncated } }
        : { error: json.error ?? "搜尋失敗,請稍後再試" };
    } catch {
      outcome = { error: "搜尋失敗,請稍後再試" };
    }
    return id === requestId.current ? outcome : null;
  }, []);

  const apply = useCallback((outcome: { result: Result } | { error: string } | null) => {
    if (!outcome) return;
    if ("result" in outcome) {
      setResult(outcome.result);
      setError("");
    } else {
      setError(outcome.error);
    }
    setLoading(false);
  }, []);

  function runSearch(query: string, rangeFrom: string, rangeTo: string) {
    setLoading(true);
    setError("");
    request(query, rangeFrom, rangeTo).then(apply);
  }

  useEffect(() => {
    if (parseKeywords(initial.q).length > 0) request(initial.q, initial.from, initial.to).then(apply);
  }, [initial, request, apply]);

  /** 編輯後是否還留在結果裡:歸屬月份仍在搜尋區間內、品名仍符合關鍵字 */
  function stillMatches(t: TransactionDTO, r: Result) {
    const name = t.item.toLowerCase();
    return t.billingPeriod >= r.from && t.billingPeriod <= r.to && parseKeywords(r.query).some((k) => name.includes(k));
  }

  function updateTransactions(update: (prev: TransactionDTO[], r: Result) => TransactionDTO[]) {
    setResult((r) => (r ? { ...r, transactions: update(r.transactions, r) } : r));
  }

  function handleSaved(saved: TransactionDTO, group?: TransactionDTO[]) {
    setEditing(null);
    // 分期是整組一起改,換成後端回傳的整組(只留仍符合搜尋條件的期數)
    if (group) {
      const groupId = saved.installmentGroupId;
      updateTransactions((prev, r) => [
        ...prev.filter((t) => t.installmentGroupId !== groupId && t._id !== saved._id),
        ...group.filter((t) => stillMatches(t, r)),
      ]);
      return;
    }
    updateTransactions((prev, r) =>
      stillMatches(saved, r) ? prev.map((t) => (t._id === saved._id ? saved : t)) : prev.filter((t) => t._id !== saved._id),
    );
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const res = await fetch(`/api/transactions/${target._id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (!res.ok) return;
    setEditing(null);
    // 分期會整組一起刪,同一組的其他期數也從結果拿掉
    const groupId = target.installmentGroupId;
    updateTransactions((prev) => prev.filter((t) => t._id !== target._id && !(groupId && t.installmentGroupId === groupId)));
  }

  /** 改了區間:已經搜尋過就用同樣的關鍵字重新搜尋 */
  function changeRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (result) runSearch(result.query, nextFrom, nextTo);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (parseKeywords(input).length === 0) {
      setError("請輸入搜尋關鍵字");
      return;
    }
    runSearch(input, from, to);
  }

  const keywords = result ? parseKeywords(result.query) : [];
  // 編輯可能改了日期,一律重新依日期新到舊排
  const all = [...(result?.transactions ?? [])].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
  const shown = typeFilter === "all" ? all : all.filter((t) => t.type === typeFilter);
  const expenseTotal = all.filter((t) => t.type === "expense").reduce((sum, t) => sum + netAmount(t), 0);
  const incomeTotal = all.filter((t) => t.type === "income").reduce((sum, t) => sum + netAmount(t), 0);
  const expenseCount = all.filter((t) => t.type === "expense").length;
  const incomeCount = all.length - expenseCount;

  // 依歸屬月份分組(結果已經依日期新到舊排好)
  const groups: { period: string; items: TransactionDTO[] }[] = [];
  for (const t of [...shown].sort((a, b) => b.billingPeriod.localeCompare(a.billingPeriod))) {
    const last = groups[groups.length - 1];
    if (last?.period === t.billingPeriod) last.items.push(t);
    else groups.push({ period: t.billingPeriod, items: [t] });
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={submit}
        className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex gap-2">
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="搜尋品名,例如:午餐,晚餐,飲料"
            aria-label="搜尋品名"
            autoFocus={!initial.q}
            className="w-full flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            搜尋
          </button>
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          品名包含關鍵字就算符合;多個關鍵字用逗號分隔,符合任一個即列出
        </p>
        {/* 手機上兩個選擇器放不下一排,改成「從 / 到」各一行 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-4 shrink-0">從</span>
            <MonthPicker value={from} onChange={(next) => changeRange(next, next > to ? next : to)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 shrink-0">到</span>
            <MonthPicker value={to} onChange={(next) => changeRange(next < from ? next : from, next)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets().map((p) => {
            const active = p.from === from && p.to === to;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => changeRange(p.from, p.to)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <div className={`flex flex-col gap-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">支出 {expenseCount} 筆</p>
                <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{money(expenseTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">收入 {incomeCount} 筆</p>
                <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{money(incomeTotal)}</p>
              </div>
            </div>
            {result.truncated && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                結果太多,只列出最近的 {all.length} 筆,合計也只算這些;可以縮小月份區間或換更精確的關鍵字
              </p>
            )}
          </div>

          {all.length > 0 && (
            <div
              role="group"
              aria-label="收支類型"
              className="flex self-start rounded-md border border-zinc-300 p-0.5 text-sm dark:border-zinc-700"
            >
              {TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setTypeFilter(o.value)}
                  aria-pressed={typeFilter === o.value}
                  className={`rounded px-3 py-1 font-medium transition-colors ${
                    typeFilter === o.value
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {all.length === 0 && !loading && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">這段期間沒有品名符合的紀錄</p>
          )}

          {groups.map((g) => {
            const groupExpense = g.items.filter((t) => t.type === "expense").reduce((s, t) => s + netAmount(t), 0);
            const groupIncome = g.items.filter((t) => t.type === "income").reduce((s, t) => s + netAmount(t), 0);
            return (
              <section key={g.period}>
                <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                  <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{monthLabel(g.period)}</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {groupExpense > 0 && `支出 ${money(groupExpense)}`}
                    {groupExpense > 0 && groupIncome > 0 && " · "}
                    {groupIncome > 0 && `收入 ${money(groupIncome)}`}
                  </p>
                </div>
                <ul className="flex flex-col gap-2">
                  {g.items.map((t) => (
                    <li key={t._id}>
                      <button
                        type="button"
                        onClick={() => setEditing(t)}
                        className="flex w-full items-center text-left justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/60"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <KindIcon kind={kindOf(t)} />
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-900 dark:text-zinc-50">
                              <Highlighted text={t.item} keywords={keywords} />
                            </p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                              {t.date.slice(0, 10)} ·{" "}
                              {t.card?.pattern && (
                                <span title={t.card.name} className="-my-1 mr-1 inline-block align-middle">
                                  <PixelIcon pattern={t.card.pattern} className="h-6 w-6" />
                                  <span className="sr-only">{t.card.name}</span>
                                </span>
                              )}
                              {CATEGORY_LABEL[t.category]}
                              {t.card && !t.card.pattern ? ` · ${t.card.name}` : ""}
                              {t.installmentInfo
                                ? ` · 第${t.installmentInfo.currentNumber}/${t.installmentInfo.totalNumber}期`
                                : ""}
                              {t.subscription ? " · 訂閱" : ""}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 font-medium ${
                            t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-900 dark:text-zinc-50"
                          }`}
                        >
                          {t.type === "income" ? "+" : ""}
                          {money(netAmount(t))}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.type === "income" ? "編輯收入" : "編輯支出"}>
        {editing && (
          <>
            <TransactionForm
              key={editing._id}
              type={editing.type}
              cards={cards}
              transaction={editing}
              onSaved={handleSaved}
              onCancel={() => setEditing(null)}
              onDelete={() => setDeleteTarget(editing)}
            />
            <Link
              href={`/${editing.type}?${new URLSearchParams({ period: editing.billingPeriod, q: editing.item })}`}
              className="mt-4 block text-center text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              到 {monthLabel(editing.billingPeriod)}的{editing.type === "income" ? "收入" : "支出"}列表查看
            </Link>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="刪除確認"
        message={
          deleteTarget?.installmentInfo
            ? `這是分期交易(共 ${deleteTarget.installmentInfo.totalNumber} 期),刪除會把全部 ${deleteTarget.installmentInfo.totalNumber} 期一起刪掉,確定嗎?`
            : "確定要刪除這筆交易嗎?"
        }
        confirmLabel="刪除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
