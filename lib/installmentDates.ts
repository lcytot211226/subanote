/**
 * 分期各期日期:第 1 期在 (anchorYear, anchorMonth) 的 day 號,之後每期加一個月;
 * 短月夾到月底,但每期都從同一個 day 重新推算,不會因為某期被夾到 28 號就一路漂移。
 * 結帳日當下未入帳(posted = false)時整組往後推一個月(postedShift = 1)。全部用 UTC。
 */
export type InstallmentAnchor = { year: number; month: number; day: number }; // month: 0-11

export function installmentDate(anchor: InstallmentAnchor, index: number, postedShift: number): Date {
  const total = anchor.year * 12 + anchor.month + index + postedShift;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(anchor.day, daysInMonth)));
}

/** 從某一期(currentNumber,從 1 起算)實際的日期回推錨點(已含 postedShift)。 */
export function anchorFromPeriod(date: Date, currentNumber: number, postedShift: number): InstallmentAnchor {
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() - (currentNumber - 1) - postedShift;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12, day: date.getUTCDate() };
}
