"use client";

import { useState, type FormEvent } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useIsDark } from "@/lib/useIsDark";
import {
  MAX_REWARD_PLANS,
  MAX_REWARD_TERMS,
  REWARD_COLORS,
  ROUNDING_LABEL,
  ROUNDINGS,
  planReward,
  type RewardPlanDTO,
  type Rounding,
} from "@/lib/rewardPlan";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import Dropdown from "./Dropdown";
import { ChartBarIcon, PlusIcon } from "./icons";

const INPUT =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50";

type DraftTerm = { rate: string; rounding: Rounding };

function money(n: number) {
  return `$${n.toLocaleString()}`;
}

/**
 * 圖表取樣點(0 ~ max):範圍小時每 1 元一點(看得到取整造成的階梯),範圍大時平均取約 200 點;
 * 一定包含 max 與 mustInclude(輸入的金額,參考線那一點的 tooltip 數字才會精準)。
 */
function samplePoints(max: number, mustInclude: number) {
  if (max <= 400) return Array.from({ length: max + 1 }, (_, i) => i);
  const step = max / 200;
  const points = Array.from({ length: 200 }, (_, i) => Math.round(i * step));
  points.push(max, mustInclude);
  return [...new Set(points)].sort((a, b) => a - b);
}

function RewardTooltip({
  active,
  payload,
  label,
  plans,
  isDark,
  gridColor,
}: TooltipContentProps<ValueType, NameType> & { plans: RewardPlanDTO[]; isDark: boolean; gridColor: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const amount = Number(label);
  const palette = isDark ? REWARD_COLORS.dark : REWARD_COLORS.light;
  const rows = plans
    .map((p) => ({ plan: p, value: planReward(amount, p.terms) }))
    .sort((a, b) => b.value - a.value);
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm"
      style={{ background: isDark ? "#1a1a19" : "#fcfcfb", border: `1px solid ${gridColor}` }}
    >
      <p className={`font-medium ${isDark ? "text-zinc-50" : "text-zinc-900"}`}>消費 {money(amount)}</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {rows.map(({ plan, value }) => (
          <li
            key={plan._id}
            className={`flex items-center justify-between gap-4 text-xs ${isDark ? "text-zinc-300" : "text-zinc-600"}`}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: palette[plan.colorIndex] }} />
              <span className="truncate">{plan.name}</span>
            </span>
            <span className="shrink-0 tabular-nums">{money(value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * /cards 下方的信用卡回饋試算:使用者自訂方案(名稱 + 幾項「金額 × 回饋率,取底 / 四捨五入」相加,見 lib/rewardPlan.ts),
 * 輸入消費金額 → 清單列出各方案的回饋(由高到低,最高的標「最高」),下面折線圖畫出 0 ~ 該金額各方案的回饋額比較。
 * 純試算,不接交易資料。方案存在資料庫(/api/reward-plans),顏色槽位固定跟著方案。
 */
export default function RewardCalculator({ initialPlans }: { initialPlans: RewardPlanDTO[] }) {
  const isDark = useIsDark();
  const [plans, setPlans] = useState(initialPlans);
  const [amountInput, setAmountInput] = useState("200");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RewardPlanDTO | null>(null);
  const [name, setName] = useState("");
  const [terms, setTerms] = useState<DraftTerm[]>([{ rate: "", rounding: "floor" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RewardPlanDTO | null>(null);

  const amount = Math.max(0, Math.floor(Number(amountInput) || 0));
  const palette = isDark ? REWARD_COLORS.dark : REWARD_COLORS.light;
  const gridColor = isDark ? "#2c2c2a" : "#e1e0d9";
  const tickColor = "#898781";

  const results = plans
    .map((plan) => ({ plan, value: planReward(amount, plan.terms) }))
    .sort((a, b) => b.value - a.value || a.plan.colorIndex - b.plan.colorIndex);
  const best = results.length > 1 && results[0].value > 0 ? results[0].value : null;

  // 圖表 X 軸多畫 10%,輸入的金額位置再畫一條參考線,看得出再多花一點回饋會怎麼跳
  const chartMax = Math.ceil(amount * 1.1);
  const chartData = amount > 0 ? samplePoints(chartMax, amount).map((x) => {
    const row: Record<string, number> = { amount: x };
    for (const plan of plans) row[plan._id] = planReward(x, plan.terms);
    return row;
  }) : [];

  // ---- 編輯 dialog ----
  const draftTerms = terms
    .filter((t) => t.rate.trim() !== "")
    .map((t) => ({ rate: Number(t.rate), rounding: t.rounding }));
  const draftValid = draftTerms.length > 0 && draftTerms.every((t) => t.rate > 0 && t.rate <= 100);

  function openAdd() {
    setEditing(null);
    setName("");
    setTerms([{ rate: "", rounding: "floor" }]);
    setError(null);
    setOpen(true);
  }

  function openEdit(plan: RewardPlanDTO) {
    setEditing(plan);
    setName(plan.name);
    setTerms(plan.terms.map((t) => ({ rate: String(t.rate), rounding: t.rounding })));
    setError(null);
    setOpen(true);
  }

  function updateTerm(index: number, patch: Partial<DraftTerm>) {
    setTerms((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draftValid) {
      setError("回饋率必須介於 0 到 100 之間");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(editing ? `/api/reward-plans/${editing._id}` : "/api/reward-plans", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), terms: draftTerms }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "儲存失敗");
      return;
    }
    const saved = data.plan as RewardPlanDTO;
    setPlans((prev) => (editing ? prev.map((p) => (p._id === saved._id ? saved : p)) : [...prev, saved]));
    setOpen(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const res = await fetch(`/api/reward-plans/${target._id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (!res.ok) return;
    setPlans((prev) => prev.filter((p) => p._id !== target._id));
    setOpen(false);
  }

  const full = plans.length >= MAX_REWARD_PLANS;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-50">
          <ChartBarIcon className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
          回饋試算
        </h2>
        <button
          type="button"
          onClick={openAdd}
          disabled={full}
          title={full ? `最多 ${MAX_REWARD_PLANS} 個方案` : undefined}
          className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <PlusIcon className="h-4 w-4" />
          新增
        </button>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="flex items-center gap-3">
          <span className="shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-300">消費金額</span>
          <span className="relative w-full max-w-xs">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-zinc-400">$</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className={`${INPUT} pl-6 tabular-nums`}
            />
          </span>
        </label>

        {plans.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            尚未建立方案。按右上角「新增」,輸入名稱與回饋規則(例如 1% 取底 + 2% 四捨五入),就能比較各方案的回饋。
          </p>
        ) : (
          <>
            {/* 結果清單兼圖例:顏色點 + 名稱 + 回饋額,規則只在點進去編輯時顯示 */}
            <ul className="flex flex-col gap-1">
              {results.map(({ plan, value }) => (
                <li key={plan._id}>
                  <button
                    type="button"
                    onClick={() => openEdit(plan)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: palette[plan.colorIndex] }} />
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">{plan.name}</span>
                      {best != null && value === best && (
                        <span className="shrink-0 rounded-full bg-zinc-900 px-1.5 text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                          最高
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                      {money(value)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {amount > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="amount"
                      type="number"
                      domain={[0, chartMax]}
                      tick={{ fill: tickColor, fontSize: 12 }}
                      axisLine={{ stroke: gridColor }}
                      tickLine={false}
                      tickFormatter={(v: number) => v.toLocaleString()}
                    />
                    <YAxis
                      tick={{ fill: tickColor, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      tickFormatter={(v: number) => v.toLocaleString()}
                    />
                    <Tooltip
                      content={(props) => (
                        <RewardTooltip {...props} plans={plans} isDark={isDark} gridColor={gridColor} />
                      )}
                    />
                    <ReferenceLine
                      x={amount}
                      stroke={isDark ? "#a1a1aa" : "#52525b"}
                      strokeDasharray="4 4"
                      label={{
                        value: money(amount),
                        position: "insideTopRight",
                        fill: isDark ? "#d4d4d8" : "#3f3f46",
                        fontSize: 12,
                      }}
                    />
                    {plans.map((plan) => (
                      <Line
                        key={plan._id}
                        // 取整造成的回饋是階梯狀,用 stepAfter 畫才不會把階梯連成斜線
                        type="stepAfter"
                        dataKey={plan._id}
                        name={plan.name}
                        stroke={palette[plan.colorIndex]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-zinc-400 dark:text-zinc-500">輸入消費金額就會畫出各方案的回饋比較圖</p>
            )}
          </>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "編輯方案" : "新增方案"} size="sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">方案名稱</label>
            <input
              required
              autoFocus={!editing}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如:CUBE 玩數位"
              className={INPUT}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">回饋規則</label>
            <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">每一項 = 金額 × 回饋率,再取底或四捨五入;各項相加</p>
            <ul className="flex flex-col gap-2">
              {terms.map((term, i) => (
                <li key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="w-3 shrink-0 text-center text-zinc-400">+</span>}
                  {i === 0 && terms.length > 1 && <span className="w-3 shrink-0" />}
                  <span className="relative w-24 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      inputMode="decimal"
                      value={term.rate}
                      onChange={(e) => updateTerm(i, { rate: e.target.value })}
                      placeholder="1"
                      aria-label={`第 ${i + 1} 項回饋率`}
                      className={`${INPUT} pr-7 tabular-nums`}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-400">
                      %
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <Dropdown
                      fullWidth
                      ariaLabel={`第 ${i + 1} 項取整方式`}
                      value={term.rounding}
                      onChange={(rounding) => updateTerm(i, { rounding })}
                      options={ROUNDINGS.map((r) => ({ value: r, label: ROUNDING_LABEL[r] }))}
                    />
                  </div>
                  {terms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTerms((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`移除第 ${i + 1} 項`}
                      className="shrink-0 rounded-md p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {terms.length < MAX_REWARD_TERMS && (
              <button
                type="button"
                onClick={() => setTerms((prev) => [...prev, { rate: "", rounding: "floor" }])}
                className="mt-2 flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <PlusIcon className="h-4 w-4" />
                加一項
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {editing ? "更新方案" : "新增方案"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
            >
              取消
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => setDeleteTarget(editing)}
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
        message={`確定要刪除「${deleteTarget?.name ?? ""}」這個方案嗎?`}
        confirmLabel="刪除"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
