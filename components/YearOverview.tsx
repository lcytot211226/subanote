"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useIsDark } from "@/lib/useIsDark";
import Modal from "./Modal";
import SharedToggleButton from "./SharedToggleButton";
import SharedNote from "./SharedNote";
import MonthRangePicker, { FULL_YEAR, type MonthRange } from "./MonthRangePicker";
import {
  ArrowDownCircleIcon,
  ArrowPathIcon,
  ArrowUpCircleIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CreditCardIcon,
  ListIcon,
  HomeIcon,
  ScaleIcon,
} from "./icons";

const INCOME_COLOR = { light: "#1a9b68", dark: "#27a674" };
// 紅綠對色盲讀者分辨度偏低(validator CVD ΔE ≈ 6,落在需要輔助編碼的區間):
// 收入固定在每組長條的左邊、支出在右,加上圖例與 tooltip 文字標示,不單靠顏色區分
const EXPENSE_COLOR = { light: "#e5484d", dark: "#e34948" };

type YearMonth = {
  period: string;
  income: number;
  expense: number;
  balance: number;
  cash: number;
  installment: number;
  subscription: number;
  utility: number;
  cards: { card: string; total: number }[];
  /** 別人分享給我、且目前勾選納入的資料,收入與支出分開合計 */
  sharedIncome: number;
  sharedExpense: number;
  /** 已納入的共享資料各分項(已含在 sharedExpense 裡) */
  sharedCash: number;
  sharedInstallment: number;
  sharedSubscription: number;
  sharedUtility: number;
};

type YearCard = { _id: string; name: string; isDebit: boolean };

type YearData = { year: number; months: YearMonth[]; cards: YearCard[] };

type ChartRow = YearMonth & { label: string };

/** 共享計入統計時,跟月檢視一樣:共享收入加進收入、共享支出加進支出(各分項也加上共享的部分),結餘跟著重算。 */
function withShared(m: YearMonth): YearMonth {
  const income = m.income + m.sharedIncome;
  const expense = m.expense + m.sharedExpense;
  return {
    ...m,
    income,
    expense,
    balance: income - expense,
    cash: m.cash + m.sharedCash,
    installment: m.installment + m.sharedInstallment,
    subscription: m.subscription + m.sharedSubscription,
    utility: m.utility + m.sharedUtility,
  };
}

function money(n: number) {
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString()}`;
}

type NumberKey = { [K in keyof YearMonth]: YearMonth[K] extends number ? K : never }[keyof YearMonth];

function sumOf(months: YearMonth[], key: NumberKey) {
  return months.reduce((total, m) => total + m[key], 0);
}

function MonthTooltip({
  active,
  payload,
  isDark,
  gridColor,
}: TooltipContentProps<ValueType, NameType> & { isDark: boolean; gridColor: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as ChartRow;
  const muted = isDark ? "text-zinc-400" : "text-zinc-500";
  const strong = isDark ? "text-zinc-50" : "text-zinc-900";

  return (
    <div
      className="rounded-lg px-3 py-2 text-sm"
      style={{ background: isDark ? "#1a1a19" : "#fcfcfb", border: `1px solid ${gridColor}` }}
    >
      <p className={`font-medium ${strong}`}>{row.period}</p>
      <p className={`mt-1 text-xs ${muted}`}>收入 {money(row.income)}</p>
      <p className={`text-xs ${muted}`}>支出 {money(row.expense)}</p>
      <p className={`text-xs ${muted}`}>結餘 {money(row.balance)}</p>
    </div>
  );
}

function Stat({ label, value, Icon, note }: { label: string; value: string; Icon: typeof ScaleIcon; note?: ReactNode }) {
  return (
    <div>
      <p className="flex items-center justify-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
        <Icon className="h-4 w-4" />
        {label}
      </p>
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
      {note}
    </div>
  );
}

function Tile({ label, value, Icon, note }: { label: string; value: string; Icon: typeof ScaleIcon; note?: ReactNode }) {
  return (
    <div className="rounded-md border border-zinc-200 p-3 text-center dark:border-zinc-800">
      <p className="flex items-center justify-center gap-1 truncate text-sm text-zinc-500 dark:text-zinc-400">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p className="break-words font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
      {note}
    </div>
  );
}

/**
 * /overview 的年度檢視:一次看一整年每個月的收支,資料每次由 GET /api/overview/year 從原始資料即時算,
 * 另附每月共享收支與各分項(別人分享給我、目前勾選納入的資料),可切換是否計入;計入時數字含共享,底下標共享多少。點某個月份(長條或列表)切回該月的月檢視。
 */
export default function YearOverview({
  year,
  onYearChange,
  onSelectMonth,
  headerRight,
}: {
  year: number;
  onYearChange: (year: number) => void;
  onSelectMonth: (period: string) => void;
  /** 年份選擇器右邊的內容(總覽的月 / 年切換鈕) */
  headerRight?: ReactNode;
}) {
  const isDark = useIsDark();
  const [data, setData] = useState<YearData | null>(null);
  const [error, setError] = useState(false);
  // 共享總額是否計入收入 / 支出 / 結餘,預設納入(同月檢視)
  const [includeShared, setIncludeShared] = useState(true);
  // 統計的月份區間,記著是哪一年選的;換一年就回到預設的 1–12 月
  const [rangeOverride, setRangeOverride] = useState<{ year: number; range: MonthRange } | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/overview/year?year=${year}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json: YearData) => {
        if (ignore) return;
        setData(json);
        setError(false);
      })
      .catch(() => {
        if (!ignore) setError(true);
      });
    return () => {
      ignore = true;
    };
  }, [year]);

  const loading = !data || data.year !== year;
  // 例如 9 月才開始記帳、或這個月還沒記完,就可以只看 9 月到上個月
  const range = rangeOverride?.year === year ? rangeOverride.range : FULL_YEAR;
  const isFullYear = range.start === 1 && range.end === 12;
  const rangeLabel = isFullYear ? "全年" : `${range.start}–${range.end} 月`;
  const rawMonths = (data?.months ?? []).filter((m) => {
    const month = Number(m.period.slice(5));
    return month >= range.start && month <= range.end;
  });
  const months = includeShared ? rawMonths.map(withShared) : rawMonths;
  // 計入共享時才在數字底下標共享多少;關閉時一律 0(不顯示)
  const sharedSum = (key: NumberKey) => (includeShared ? sumOf(rawMonths, key) : 0);
  const sharedIncome = sharedSum("sharedIncome");
  const sharedExpense = sharedSum("sharedExpense");
  const incomeColor = isDark ? INCOME_COLOR.dark : INCOME_COLOR.light;
  const expenseColor = isDark ? EXPENSE_COLOR.dark : EXPENSE_COLOR.light;
  const gridColor = isDark ? "#2c2c2a" : "#e1e0d9";
  const tickColor = "#898781";

  const income = sumOf(months, "income");
  const expense = sumOf(months, "expense");
  const balance = sumOf(months, "balance");
  // 平均只算有收支紀錄的月份,未來或沒記帳的月份不拉低平均
  const activeMonths = months.filter((m) => m.income !== 0 || m.expense !== 0).length;
  const rows: ChartRow[] = months.map((m) => ({ ...m, label: `${Number(m.period.slice(5))}月` }));

  const cardTotals = new Map<string, number>();
  for (const m of months) {
    for (const c of m.cards) cardTotals.set(c.card, (cardTotals.get(c.card) ?? 0) + c.total);
  }
  const cardNameById = new Map((data?.cards ?? []).map((c) => [c._id, c.name]));
  // 先列現有的卡(依建立順序),再列已刪除但這年還有金額的卡
  const cardRows = [
    ...(data?.cards ?? []).map((c) => ({ id: c._id, name: c.name, total: cardTotals.get(c._id) ?? 0 })),
    ...Array.from(cardTotals)
      .filter(([id]) => !cardNameById.has(id))
      .map(([id, total]) => ({ id, name: "已刪除的信用卡", total })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onYearChange(year - 1)}
            aria-label="上一年"
            className="rounded-md border border-zinc-300 px-2 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            ◀
          </button>
          <span className="min-w-20 rounded-md border border-zinc-300 px-3 py-2 text-center text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
            {year} 年
          </span>
          <button
            type="button"
            onClick={() => onYearChange(year + 1)}
            aria-label="下一年"
            className="rounded-md border border-zinc-300 px-2 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            ▶
          </button>
        </div>
        <div className="mr-auto">
          <MonthRangePicker value={range} onChange={(next) => setRangeOverride({ year, range: next })} />
        </div>
        {headerRight}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">年度資料載入失敗,請稍後再試</p>}

      {/* 切換年份時先保留上一年的畫面(變淡),新資料回來再換掉,避免整塊閃掉 */}
      <div className={`flex flex-col gap-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
            <Stat label="年收入" value={money(income)} Icon={ArrowUpCircleIcon} note={<SharedNote amount={sharedIncome} />} />
            <Stat label="年支出" value={money(expense)} Icon={ArrowDownCircleIcon} note={<SharedNote amount={sharedExpense} />} />
            <Stat
              label="年結餘"
              value={money(balance)}
              Icon={ScaleIcon}
              note={<SharedNote amount={sharedIncome - sharedExpense} show={sharedIncome !== 0 || sharedExpense !== 0} />}
            />
            <Stat
              label="月平均支出"
              value={activeMonths > 0 ? money(Math.round(expense / activeMonths)) : "-"}
              Icon={CalendarDaysIcon}
            />
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-50">
              <ChartBarIcon className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
              {year} 每月收支{isFullYear ? "" : `(${rangeLabel})`}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: incomeColor }} />
                收入
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: expenseColor }} />
                支出
              </span>
              {/* 跟下方「支出分項」標題列的共享按鈕是同一個開關 */}
              <SharedToggleButton on={includeShared} onToggle={() => setIncludeShared((prev) => !prev)} />
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 16, right: 16, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="1 0" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: tickColor, fontSize: 12 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: tickColor, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) => value.toLocaleString()}
                />
                <Tooltip
                  cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                  content={(props) => <MonthTooltip {...props} isDark={isDark} gridColor={gridColor} />}
                />
                <Bar
                  dataKey="income"
                  name="收入"
                  fill={incomeColor}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                  cursor="pointer"
                  onClick={(_, index) => onSelectMonth(rows[index].period)}
                />
                <Bar
                  dataKey="expense"
                  name="支出"
                  fill={expenseColor}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                  cursor="pointer"
                  onClick={(_, index) => onSelectMonth(rows[index].period)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">點長條可切到該月</p>
            <button
              type="button"
              onClick={() => setShowTable(true)}
              className="flex shrink-0 items-center gap-1 rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <ListIcon className="h-3.5 w-3.5" />
              明細表
            </button>
          </div>
        </div>

        <Modal open={showTable} onClose={() => setShowTable(false)} title={`${year} 每月明細`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-2 py-2 text-left font-medium">月份</th>
                <th className="px-2 py-2 text-right font-medium">收入</th>
                <th className="px-2 py-2 text-right font-medium">支出</th>
                <th className="px-2 py-2 text-right font-medium">結餘</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={m.period}
                  onClick={() => onSelectMonth(m.period)}
                  className="cursor-pointer border-b border-zinc-100 text-zinc-900 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:text-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMonth(m.period);
                      }}
                      aria-label={`查看 ${m.period}`}
                      className="text-left"
                    >
                      {m.label}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{money(m.income)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{money(m.expense)}</td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums ${m.balance < 0 ? "text-red-600 dark:text-red-400" : ""}`}
                  >
                    {money(m.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-200 font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
                <td className="px-2 py-2">合計</td>
                <td className="px-2 py-2 text-right tabular-nums">{money(income)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{money(expense)}</td>
                <td className={`px-2 py-2 text-right tabular-nums ${balance < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                  {money(balance)}
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">點某個月份可切到該月的月檢視</p>
        </Modal>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          {cardRows.length > 0 && (
            <>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  <CreditCardIcon className="h-4 w-4" />
                  信用卡
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  合計{" "}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {money(cardRows.reduce((sum, c) => sum + c.total, 0))}
                  </span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {cardRows.map((c) => (
                  <Tile key={c.id} label={c.name} value={money(c.total)} Icon={CreditCardIcon} />
                ))}
              </div>
            </>
          )}
          <div className={`mb-2 flex items-center justify-between gap-2 ${cardRows.length > 0 ? "mt-4" : ""}`}>
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{rangeLabel}支出分項</h3>
            <SharedToggleButton on={includeShared} onToggle={() => setIncludeShared((prev) => !prev)} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile
              label="現金"
              value={money(sumOf(months, "cash"))}
              Icon={BanknotesIcon}
              note={<SharedNote amount={sharedSum("sharedCash")} />}
            />
            <Tile
              label="分期"
              value={money(sumOf(months, "installment"))}
              Icon={CalendarDaysIcon}
              note={<SharedNote amount={sharedSum("sharedInstallment")} />}
            />
            <Tile
              label="訂閱"
              value={money(sumOf(months, "subscription"))}
              Icon={ArrowPathIcon}
              note={<SharedNote amount={sharedSum("sharedSubscription")} />}
            />
            <Tile
              label="房租水電"
              value={money(sumOf(months, "utility"))}
              Icon={HomeIcon}
              note={<SharedNote amount={sharedSum("sharedUtility")} />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
