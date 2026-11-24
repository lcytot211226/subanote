import { NextResponse } from "next/server";
import CardReconciliation, { type CardReconciliationStatus } from "@/lib/models/CardReconciliation";

export type ReconciledConflict = { period: string; status: CardReconciliationStatus };

/**
 * 新增信用卡 / 分期交易時,檢查這張卡在交易歸屬的月份是否已經對帳(或已繳費)。
 * 有的話回傳 409 + `reconciled`(哪幾個月、什麼狀態),前端跳確認,使用者確認後帶 `confirmReconciled: true` 重送。
 * 沒有衝突回傳 null。簽帳金融卡沒有對帳,呼叫端不用檢查。
 */
export async function reconciledConflictResponse(
  userId: string,
  cardId: string,
  periods: string[]
): Promise<NextResponse | null> {
  const records = await CardReconciliation.find({
    user: userId,
    card: cardId,
    period: { $in: Array.from(new Set(periods)) },
  })
    .sort({ period: 1 })
    .lean();
  if (records.length === 0) return null;
  const reconciled: ReconciledConflict[] = records.map((r) => ({
    period: r.period,
    status: (r.status ?? "reconciled") as CardReconciliationStatus,
  }));
  return NextResponse.json({ error: "該月帳單已對帳", reconciled }, { status: 409 });
}
