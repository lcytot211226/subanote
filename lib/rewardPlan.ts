/**
 * 信用卡回饋試算(/cards 下方的「回饋試算」):使用者自訂「方案」,每個方案是幾個項目相加,
 * 每一項 = 金額 × 回饋率(%),再取底或四捨五入。純計算,不接任何交易資料。
 * 例如「1% 取底 + 2% 四捨五入」,消費 $1,050 → floor(10.5) + round(21) = 10 + 21 = 31。
 */

export const ROUNDINGS = ["floor", "round"] as const;
export type Rounding = (typeof ROUNDINGS)[number];

export const ROUNDING_LABEL: Record<Rounding, string> = {
  floor: "取底",
  round: "四捨五入",
};

export type RewardTerm = { rate: number; rounding: Rounding };

export type RewardPlanDTO = {
  _id: string;
  name: string;
  terms: RewardTerm[];
  /** 圖表顏色的固定槽位(0-7),新增時決定,刪掉別的方案也不會變色 */
  colorIndex: number;
};

/** 一個人最多幾個方案:圖表顏色只有 8 個驗證過的槽位,不能再多 */
export const MAX_REWARD_PLANS = 8;
/** 一個方案最多幾項 */
export const MAX_REWARD_TERMS = 10;

/**
 * 方案顏色(dataviz 參考調色盤的分類色,淺色 / 深色各一組,已跑過驗證:CVD 與一般視覺分離度都通過)。
 * 淺色模式下有幾色對比偏低,所以畫面上一律搭配方案名稱與金額的清單,顏色不是唯一的辨識方式。
 */
export const REWARD_COLORS = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};

// 金額 × 回饋率用浮點數算會有誤差(例如 1000 × 2.3% = 22.999999…),取整前先補一個極小值
const EPSILON = 1e-9;

export function termReward(amount: number, term: RewardTerm): number {
  const raw = (amount * term.rate) / 100;
  return term.rounding === "floor" ? Math.floor(raw + EPSILON) : Math.round(raw + EPSILON);
}

export function planReward(amount: number, terms: RewardTerm[]): number {
  return terms.reduce((sum, term) => sum + termReward(amount, term), 0);
}

/** API 用:驗證並整理 terms,回傳 { value } 或 { error } */
export function parseTerms(raw: unknown): { value: RewardTerm[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: "至少要有一項回饋" };
  if (raw.length > MAX_REWARD_TERMS) return { error: `最多 ${MAX_REWARD_TERMS} 項` };
  const terms: RewardTerm[] = [];
  for (const item of raw) {
    const rate = Number(item?.rate);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 100) return { error: "回饋率必須介於 0 到 100 之間" };
    if (!(ROUNDINGS as readonly string[]).includes(item?.rounding)) return { error: "取整方式不正確" };
    terms.push({ rate, rounding: item.rounding });
  }
  return { value: terms };
}
