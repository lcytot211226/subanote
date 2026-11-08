/** 數字底下的「共享 $X」:表示上面的金額含有多少來自已納入的共享資料;預設金額不為 0 才顯示。月 / 年檢視共用。 */
export default function SharedNote({ amount, show = amount !== 0 }: { amount: number; show?: boolean }) {
  if (!show) return null;
  return (
    <p className="text-xs tabular-nums text-indigo-500 dark:text-indigo-400">
      共享 {amount < 0 ? "-" : ""}${Math.abs(amount).toLocaleString()}
    </p>
  );
}
