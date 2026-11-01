/**
 * 自訂項目的日期(DD)驗證:空值 / null 代表沒填;否則必須是該月份存在的日子(例如 2 月不能填 30)。
 * 回傳 { value }(null = 沒填)或 { error }。
 */
export function parseCustomItemDate(
  raw: unknown,
  year: number,
  month: number
): { value: number | null } | { error: string } {
  if (raw === undefined || raw === null || raw === "") return { value: null };
  const day = Number(raw);
  const daysInMonth = new Date(year, month, 0).getDate();
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth) {
    return { error: `日期必須是 1 到 ${daysInMonth} 之間的整數` };
  }
  return { value: day };
}
