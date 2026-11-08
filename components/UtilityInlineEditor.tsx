"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { calculateMeterCost, calculateMeterCostExact, type MeterInfo } from "@/lib/calculateMeterCost";
import RoundedAmount from "./RoundedAmount";
import Switch from "./Switch";
import SharedToggleButton from "./SharedToggleButton";
import type { SharedUtilityParts } from "@/lib/sharedTransactions";
import { BanknotesIcon, BoltIcon, CalendarDaysIcon, ClockIcon, HomeIcon, PlusIcon, WaterDropIcon } from "./icons";

export type UtilityDTO = {
  date: number;
  rent: number;
  elec: MeterInfo;
  water: MeterInfo;
  rentEnabled: boolean;
  elecEnabled: boolean;
  waterEnabled: boolean;
  // 總開關,獨立於上面三個個別開關之外,只影響顯示/統計要不要把這個月算進去。
  enabled: boolean;
  // 是否已繳費,純進度標記、不影響金額;只透過 PATCH /api/utilities 切換,PUT 整份覆寫不會動到它。
  paid: boolean;
};

type MeterField = "elec" | "water";

const emptyMeter: MeterInfo = { start: 0, end: 0, unitPrice: 0, manualAmount: null };

const emptyUtility: UtilityDTO = {
  date: 1,
  rent: 0,
  elec: { ...emptyMeter },
  water: { ...emptyMeter },
  rentEnabled: true,
  elecEnabled: true,
  waterEnabled: true,
  enabled: true,
  paid: false,
};

/** 把 API 回傳的房租水電轉成 UtilityDTO;舊資料可能是在新增水費欄位/開關欄位前建立的,補上預設值避免畫面壞掉。 */
export function toUtilityDTO(found: Pick<UtilityDTO, "date" | "rent"> & Partial<UtilityDTO>): UtilityDTO {
  return {
    date: found.date,
    rent: found.rent,
    elec: found.elec ?? { ...emptyMeter },
    water: found.water ?? { ...emptyMeter },
    rentEnabled: found.rentEnabled ?? true,
    elecEnabled: found.elecEnabled ?? true,
    waterEnabled: found.waterEnabled ?? true,
    enabled: found.enabled ?? true,
    paid: found.paid ?? false,
  };
}

const METER_LABEL: Record<
  MeterField,
  { name: string; short: string; Icon: typeof BoltIcon; tint: string; iconColor: string }
> = {
  elec: {
    name: "電費",
    short: "電表",
    Icon: BoltIcon,
    tint: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
    iconColor: "text-amber-500 dark:text-amber-400",
  },
  water: {
    name: "水費",
    short: "水表",
    Icon: WaterDropIcon,
    tint: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
    iconColor: "text-sky-500 dark:text-sky-400",
  },
};

const RENT_TINT = "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400";
const DATE_TINT = "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

const INPUT_CLASS =
  "w-full min-w-0 bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none dark:text-zinc-50";

/** 數字欄位,可加前綴($)或後綴(度、號),外框跟一般輸入框一致,focus 時整個外框亮起。 */
function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  prefix?: string;
  suffix?: string;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="flex items-center rounded-md border border-zinc-300 bg-white focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:border-zinc-400 dark:focus-within:ring-zinc-400">
        {prefix && <span className="pl-3 text-sm text-zinc-400 dark:text-zinc-500">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`${INPUT_CLASS} ${prefix ? "pl-1.5" : ""}`}
        />
        {suffix && <span className="whitespace-nowrap pr-3 text-sm text-zinc-400 dark:text-zinc-500">{suffix}</span>}
      </span>
    </label>
  );
}

function IconBadge({ tint, children }: { tint: string; children: ReactNode }) {
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tint}`}>{children}</span>
  );
}

/** 用量說明,例如「100 → 220,120 度 × $5.5」;直接輸入金額時顯示「直接輸入金額」。預覽空間有限,放在 tooltip。 */
function meterDetail(meter: MeterInfo) {
  if (meter.manualAmount !== null) return "直接輸入金額";
  const usage = Math.max(0, meter.end - meter.start);
  return `${meter.start.toLocaleString()} → ${meter.end.toLocaleString()},${usage.toLocaleString()} 度 × $${meter.unitPrice.toLocaleString()}`;
}

/** 預覽列的一格:小圖示 + 名稱、底下金額;沒計入統計的項目變淡、金額加刪除線。 */
function Tile({
  icon,
  name,
  value,
  enabled = true,
  title,
  sharedAmount = 0,
}: {
  icon: ReactNode;
  name: string;
  value: ReactNode;
  enabled?: boolean;
  title?: string;
  /** value 裡含有多少是共享的;> 0 時在底下標「共享 $X」 */
  sharedAmount?: number;
}) {
  return (
    <div
      title={title ?? (enabled ? undefined : `${name}未計入統計`)}
      className={`min-w-0 rounded-md border border-zinc-200 px-1 py-2.5 text-center transition-opacity sm:px-2 sm:py-3 dark:border-zinc-800 ${enabled ? "" : "opacity-40"}`}
    >
      <p className="flex items-center justify-center gap-1 text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
        {icon}
        <span className="truncate">{name}</span>
      </p>
      <p className={`mt-0.5 truncate text-base font-semibold tabular-nums text-zinc-900 sm:text-lg dark:text-zinc-50 ${enabled ? "" : "line-through"}`}>
        {value}
      </p>
      {sharedAmount > 0 && (
        <p className="truncate text-xs tabular-nums text-indigo-500 dark:text-indigo-400">
          共享 ${Math.round(sharedAmount).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function MeterEditor({
  field,
  meter,
  enabled,
  onChange,
  onToggleEnabled,
}: {
  field: MeterField;
  meter: MeterInfo;
  enabled: boolean;
  onChange: (next: MeterInfo) => void;
  onToggleEnabled: (next: boolean) => void;
}) {
  const label = METER_LABEL[field];
  const isManual = meter.manualAmount !== null;

  function setManualMode(manual: boolean) {
    onChange({ ...meter, manualAmount: manual ? (meter.manualAmount ?? 0) : null });
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconBadge tint={label.tint}>
            <label.Icon className="h-4 w-4" />
          </IconBadge>
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{label.name}</span>
        </div>
        <Switch checked={enabled} onChange={onToggleEnabled} label="計入統計" />
      </div>

      <div className={`transition-opacity ${enabled ? "" : "opacity-50"}`}>
        <div className="mb-3 grid grid-cols-2 gap-0.5 rounded-md bg-zinc-100 p-0.5 text-sm dark:bg-zinc-800">
          {[
            { manual: false, text: `依${label.short}計算` },
            { manual: true, text: "直接輸入金額" },
          ].map((opt) => (
            <button
              key={String(opt.manual)}
              type="button"
              onClick={() => setManualMode(opt.manual)}
              aria-pressed={isManual === opt.manual}
              className={`rounded px-2 py-1 transition-colors ${
                isManual === opt.manual
                  ? "bg-white font-medium text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              {opt.text}
            </button>
          ))}
        </div>

        {!isManual ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumberField
              label={`${label.short}起始`}
              value={meter.start}
              onChange={(start) => onChange({ ...meter, start })}
              suffix="度"
            />
            <NumberField
              label={`${label.short}結束`}
              value={meter.end}
              onChange={(end) => onChange({ ...meter, end })}
              suffix="度"
            />
            <div className="col-span-2 sm:col-span-1">
              <NumberField
                label="每度單價"
                value={meter.unitPrice}
                onChange={(unitPrice) => onChange({ ...meter, unitPrice })}
                prefix="$"
                step="0.01"
              />
            </div>
          </div>
        ) : (
          <NumberField
            label={`${label.name}金額`}
            value={meter.manualAmount ?? 0}
            onChange={(manualAmount) => onChange({ ...meter, manualAmount })}
            prefix="$"
          />
        )}

        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">
            {isManual ? "小計" : `用量 ${Math.max(0, meter.end - meter.start).toLocaleString()} 度 · 小計`}
          </span>
          <RoundedAmount value={calculateMeterCostExact(meter)} className="font-medium text-zinc-900 dark:text-zinc-50" />
        </div>
      </div>
    </div>
  );
}

/** 跟 lib/summarizeMonth 一致:電費/水費四捨五入後才加總,只算有開「計入統計」的項目。 */
function subtotalOf(u: UtilityDTO) {
  return (
    (u.rentEnabled ? u.rent : 0) +
    (u.elecEnabled ? calculateMeterCost(u.elec) : 0) +
    (u.waterEnabled ? calculateMeterCost(u.water) : 0)
  );
}

function PaidBadge({ paid, disabled, onToggle }: { paid: boolean; disabled: boolean; onToggle: () => void }) {
  // 顏色跟 /overview 信用卡的「已繳費」標籤一致(sky),未繳費用灰色
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={paid ? "本月房租水電已繳費,點擊改回未繳費" : "尚未繳費:點擊標記本月房租水電已繳費"}
      aria-label={paid ? "已繳費" : "未繳費"}
      className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs sm:px-2 font-medium transition-colors disabled:opacity-60 ${
        paid
          ? "bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-400 dark:hover:bg-sky-900/60"
          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      }`}
    >
      {paid ? <BanknotesIcon className="h-3.5 w-3.5" /> : <ClockIcon className="h-3.5 w-3.5" />}
      {/* 手機上標題列要塞合計、總開關、繳費、編輯,文字收起來只留圖示(同信用卡未對帳只顯示圖示) */}
      <span className="hidden sm:inline">{paid ? "已繳費" : "未繳費"}</span>
    </button>
  );
}

export default function UtilityInlineEditor({
  year,
  month,
  utility,
  loading,
  onSaved,
  onPaidChange,
  shared,
}: {
  year: number;
  month: number;
  utility: UtilityDTO | null;
  loading: boolean;
  /**
   * 有已納入的分享時才傳:parts 是分享者當月計入統計的房租水電(共享開關關閉時為 null),
   * 每格與合計都顯示「自己 + 共享」的加總,底下標「共享 $X」;on / onToggle 是共享開關(跟總覽其他共享開關同一個),放在標題列最右邊。
   */
  shared?: { parts: SharedUtilityParts | null; on: boolean; onToggle: () => void };
  /** 儲存成功後帶入 API 回傳的最新資料,外層直接更新本地狀態,不重新載入整個總覽。 */
  onSaved: (utility: UtilityDTO) => void;
  /** 繳費狀態切換後通知外層更新本地資料(不重新載入整個總覽,跟信用卡對帳標籤一樣即時反應)。 */
  onPaidChange: (paid: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UtilityDTO>(utility ?? emptyUtility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingAll, setTogglingAll] = useState(false);
  const [togglingPaid, setTogglingPaid] = useState(false);

  function startEdit() {
    setForm(utility ?? emptyUtility);
    setError(null);
    setEditing(true);
  }

  // 先樂觀更新畫面,API 失敗再改回來。
  async function togglePaid() {
    if (!utility) return;
    const next = !utility.paid;
    onPaidChange(next);
    setTogglingPaid(true);
    const res = await fetch("/api/utilities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, paid: next }),
    }).catch(() => null);
    setTogglingPaid(false);
    if (!res?.ok) onPaidChange(!next);
  }

  // 總開關:只決定這個月的房租水電要不要顯示/計入統計,不會動到租金/電費/水費各自的開關,
  // 資料原封不動送出去,重新打開後租金/電費/水費原本的狀態都還在。若只想關掉其中一項,要點「編輯」進去個別設定。
  async function toggleMasterEnabled() {
    const display = utility ?? emptyUtility;
    const next = !display.enabled;
    setTogglingAll(true);
    const res = await fetch("/api/utilities", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year,
        month,
        date: display.date,
        rent: display.rent,
        elec: display.elec,
        water: display.water,
        rentEnabled: display.rentEnabled,
        elecEnabled: display.elecEnabled,
        waterEnabled: display.waterEnabled,
        enabled: next,
      }),
    });
    const data = await res.json().catch(() => null);
    setTogglingAll(false);
    if (res.ok && data?.utility) onSaved(toUtilityDTO(data.utility));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    // paid 不送:繳費狀態只由 PATCH 切換,避免編輯金額時用舊的表單值把它蓋掉。
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { paid, ...rest } = form;
    const res = await fetch("/api/utilities", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, ...rest }),
    });
    const data = await res.json();

    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "儲存失敗");
      return;
    }

    setEditing(false);
    onSaved(toUtilityDTO(data.utility));
  }

  const header = (right?: ReactNode) => (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <HomeIcon className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
        <h2 className="whitespace-nowrap font-medium text-zinc-900 dark:text-zinc-50">房租水電費</h2>
      </div>
      {right}
    </div>
  );

  const sharedParts = shared?.parts ?? null;
  const sharedTotal = sharedParts?.total ?? 0;
  const sharedButton = shared && <SharedToggleButton on={shared.on} onToggle={shared.onToggle} />;

  /**
   * 帳單日 / 租金 / 電費 / 水費四格:每格 = 自己 + 共享,底下標共享多少。
   * 自己沒資料時(own = null)就只有共享的部分;自己的項目沒計入統計、又沒有共享金額時才變淡加刪除線。
   */
  const tilesGrid = (own: UtilityDTO | null) => {
    const dim = !!own && !own.enabled && sharedTotal === 0;
    return (
      <div className={`mt-3 grid grid-cols-4 gap-2 transition-opacity ${dim ? "opacity-40" : ""}`}>
        <Tile
          icon={<CalendarDaysIcon className="h-4 w-4 shrink-0" />}
          name="帳單日"
          value={`${own?.date ?? sharedParts?.date ?? "-"} 號`}
        />
        <Tile
          icon={<HomeIcon className="h-4 w-4 shrink-0 text-violet-500 dark:text-violet-400" />}
          name="租金"
          value={`$${((own?.rent ?? 0) + (sharedParts?.rent ?? 0)).toLocaleString()}`}
          enabled={!own || own.rentEnabled || (sharedParts?.rent ?? 0) > 0}
          sharedAmount={sharedParts?.rent}
        />
        {(["elec", "water"] as const).map((field) => {
          const label = METER_LABEL[field];
          const ownEnabled = own ? (field === "elec" ? own.elecEnabled : own.waterEnabled) : true;
          const sharedPart = sharedParts?.[field] ?? 0;
          return (
            <Tile
              key={field}
              icon={<label.Icon className={`h-4 w-4 shrink-0 ${label.iconColor}`} />}
              name={label.name}
              value={<RoundedAmount value={(own ? calculateMeterCostExact(own[field]) : 0) + sharedPart} />}
              enabled={ownEnabled || sharedPart > 0}
              title={own ? `${meterDetail(own[field])}${ownEnabled ? "" : "(未計入統計)"}` : undefined}
              sharedAmount={sharedPart}
            />
          );
        })}
      </div>
    );
  };

  if (!editing) {
    // 還不知道這個月到底有沒有資料時,顯示骨架畫面,不要用 emptyUtility 的 0 冒充「沒有資料」,
    // 避免使用者看到「一下有資料、一下沒資料」的閃爍。
    if (loading && !utility) {
      return (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          {header()}
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 rounded-md border border-zinc-200 px-1 py-2.5 sm:px-2 sm:py-3 dark:border-zinc-800">
                <div className="h-4 w-10 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-6 w-14 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (!utility) {
      const addButton = (
        <button
          type="button"
          onClick={startEdit}
          className="flex shrink-0 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          <PlusIcon className="h-4 w-4" />
          新增
        </button>
      );

      // 自己沒資料、但有已納入的共享房租水電:版面跟自己有資料時一樣(標題旁合計 + 四格),
      // 只是唯讀(沒有總開關 / 繳費 / 編輯),右邊的「新增」仍可建立自己的資料
      if (sharedParts) {
        return (
          <div
            className={`rounded-lg border border-zinc-200 bg-white p-4 transition-opacity dark:border-zinc-800 dark:bg-zinc-900 ${loading ? "opacity-60" : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-baseline gap-2">
                <h2 className="flex items-center gap-2 self-center whitespace-nowrap font-medium text-zinc-900 dark:text-zinc-50">
                  <HomeIcon className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  房租水電費
                </h2>
                <span className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  ${sharedTotal.toLocaleString()}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {addButton}
                {sharedButton}
              </div>
            </div>
            {tilesGrid(null)}
          </div>
        );
      }

      // 空狀態收成單行:只留標題列,右邊淡色提示 +「新增」
      return (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          {header(
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm text-zinc-400 dark:text-zinc-500">本月無資料</span>
              <div className="flex items-center gap-2">
                {addButton}
                {sharedButton}
              </div>
            </div>
          )}
        </div>
      );
    }

    const display = utility;
    // 總開關關掉時,金額改成刪除線、整列變暗,但租金/電費/水費原本的數字跟各自開關狀態都還在,不會被清空。
    // 有共享時合計 = 自己計入的部分 + 共享,就不用刪除線了。
    const ownCost = subtotalOf(display);
    const totalCost = sharedTotal > 0 ? (display.enabled ? ownCost : 0) + sharedTotal : ownCost;
    const totalStruck = !display.enabled && sharedTotal === 0;

    return (
      <div
        className={`rounded-lg border border-zinc-200 bg-white p-4 transition-opacity dark:border-zinc-800 dark:bg-zinc-900 ${loading ? "opacity-60" : ""}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="flex items-center gap-2 self-center whitespace-nowrap font-medium text-zinc-900 dark:text-zinc-50">
              <HomeIcon className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
              房租水電費
            </h2>
            <span
              className={`truncate text-base font-semibold ${totalStruck ? "text-zinc-400 line-through dark:text-zinc-500" : "text-zinc-900 dark:text-zinc-50"}`}
            >
              ${totalCost.toLocaleString()}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div title="總開關:是否把這個月的房租水電計入上方支出/結餘統計;不會動到租金/電費/水費各自的開關。若要個別關閉租金/電費/水費,請點「編輯」">
              <Switch checked={display.enabled} onChange={toggleMasterEnabled} disabled={togglingAll} />
            </div>
            <PaidBadge paid={display.paid} disabled={togglingPaid} onToggle={togglePaid} />
            <button
              type="button"
              onClick={startEdit}
              className="rounded-md border border-zinc-300 px-2.5 py-0.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              編輯
            </button>
            {sharedButton}
          </div>
        </div>

        {tilesGrid(display)}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {header(<span className="text-sm text-zinc-500 dark:text-zinc-400">編輯中</span>)}

      <div className="mt-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* 帳單日跟租金、電費、水費一樣用外框 + 圖示標題,維持一致的格式 */}
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="mb-2 flex items-center gap-2">
              <IconBadge tint={DATE_TINT}>
                <CalendarDaysIcon className="h-4 w-4" />
              </IconBadge>
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">帳單日</span>
            </div>
            <NumberField
              label="每月"
              value={form.date}
              onChange={(date) => setForm({ ...form, date })}
              suffix="號"
              min={1}
              max={31}
            />
          </div>
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <IconBadge tint={RENT_TINT}>
                  <HomeIcon className="h-4 w-4" />
                </IconBadge>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">租金</span>
              </div>
              <Switch
                checked={form.rentEnabled}
                onChange={(next) => setForm({ ...form, rentEnabled: next })}
                label="計入統計"
              />
            </div>
            <div className={`transition-opacity ${form.rentEnabled ? "" : "opacity-50"}`}>
              <NumberField
                label="金額"
                value={form.rent}
                onChange={(rent) => setForm({ ...form, rent })}
                prefix="$"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <MeterEditor
            field="elec"
            meter={form.elec}
            enabled={form.elecEnabled}
            onChange={(next) => setForm({ ...form, elec: next })}
            onToggleEnabled={(next) => setForm({ ...form, elecEnabled: next })}
          />
          <MeterEditor
            field="water"
            meter={form.water}
            enabled={form.waterEnabled}
            onChange={(next) => setForm({ ...form, water: next })}
            onToggleEnabled={(next) => setForm({ ...form, waterEnabled: next })}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          合計
          <span className="ml-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            ${subtotalOf(form).toLocaleString()}
          </span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setForm(utility ?? emptyUtility);
              setEditing(false);
            }}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {saving ? "儲存中..." : "儲存"}
          </button>
        </div>
      </div>
    </form>
  );
}
