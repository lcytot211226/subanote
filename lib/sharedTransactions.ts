import type { TransactionKind, TransactionType } from "@/lib/transactionKind";
import { calculateMeterCost, calculateMeterCostExact, type MeterInfo } from "@/lib/calculateMeterCost";

/**
 * 別人分享給我的交易:後端已經把品項名稱、卡片、備註等可辨識的內容都拿掉,只留統計需要的欄位。
 * 前端一律顯示成「共享項目」(SHARED_ITEM_LABEL),用來併進每日支出圖表、分類統計與收支總額。
 */
export type SharedTransaction = {
  type: TransactionType;
  /** 交易實際日期(ISO 字串) */
  date: string;
  category: "installment" | "cash" | "credit_card";
  kind: TransactionKind;
  /** 實際計入統計的金額(已扣掉點數折抵) */
  amount: number;
  /** 是否為訂閱生成的交易(每日支出圖表預設不畫分期 / 訂閱) */
  isSubscription: boolean;
};

/** 分享者當月的房租水電明細(不含繳費狀態);自己這個月沒有房租水電資料時,/overview 房租水電區塊改顯示它。 */
export type SharedUtility = {
  date: number;
  rent: number;
  elec: MeterInfo;
  water: MeterInfo;
  rentEnabled: boolean;
  elecEnabled: boolean;
  waterEnabled: boolean;
  enabled: boolean;
};

/** 別人分享給我的一份資料(一個分享者一筆),金額每次讀取都從對方的原始資料即時算出。 */
export type IncomingShare = {
  _id: string;
  ownerEmail: string;
  /** 收件人是否選擇把這份分享納入自己的收支統計 */
  included: boolean;
  /** 分享者當月收入 / 支出(支出含房租水電) */
  income: number;
  expense: number;
  /** 分享者當月房租水電(只計入支出總額,不畫進圖表、分類統計,跟自己的房租水電一樣) */
  utility: number;
  /** 分享者當月房租水電明細,沒有資料為 null */
  utilityDetail: SharedUtility | null;
  transactions: SharedTransaction[];
};

export const SHARED_ITEM_LABEL = "共享項目";

/** 已納入(included)的分享,收入與支出分開加總。 */
export function includedSharedTotals(shares: IncomingShare[]): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const share of shares) {
    if (!share.included) continue;
    income += share.income;
    expense += share.expense;
  }
  return { income, expense };
}

/** 已納入的分享者當月房租水電,各項只算有計入統計的部分(多位分享者時相加);電費 / 水費是含小數的實際金額。 */
export type SharedUtilityParts = {
  /** 帳單日(多位時取最早的一天) */
  date: number;
  rent: number;
  elec: number;
  water: number;
  /** 計入統計的合計(電費 / 水費先四捨五入再加,跟 summarizeMonth 一致) */
  total: number;
};

export function sharedUtilityParts(details: SharedUtility[]): SharedUtilityParts | null {
  if (details.length === 0) return null;
  const parts: SharedUtilityParts = { date: Math.min(...details.map((d) => d.date)), rent: 0, elec: 0, water: 0, total: 0 };
  for (const d of details) {
    if (!d.enabled) continue;
    if (d.rentEnabled) {
      parts.rent += d.rent;
      parts.total += d.rent;
    }
    if (d.elecEnabled) {
      parts.elec += calculateMeterCostExact(d.elec);
      parts.total += calculateMeterCost(d.elec);
    }
    if (d.waterEnabled) {
      parts.water += calculateMeterCostExact(d.water);
      parts.total += calculateMeterCost(d.water);
    }
  }
  return parts;
}
