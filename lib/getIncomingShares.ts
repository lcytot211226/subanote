import Share from "@/lib/models/Share";
// 只需要註冊 User model 讓 populate("owner") 能運作,不需要值本身,所以只做 side-effect import。
import "@/lib/models/User";
import type { User as UserDoc } from "@/lib/models/User";
import { loadMonthData, monthDataFor, summarizeMonthData } from "@/lib/computeMonthSummaries";
import { kindOf } from "@/lib/transactionKind";
import { netAmount } from "@/lib/pointsDiscount";
import type { IncomingShare } from "@/lib/sharedTransactions";

const EMPTY_METER = { start: 0, end: 0, unitPrice: 0, manualAmount: null };

/**
 * 別人分享給 email 的資料(一個分享者一筆):每次都從分享者當月的原始交易與房租水電即時算。
 * 交易在這裡就把品項名稱、卡片等內容拿掉,只回傳統計需要的欄位,不會送到收件人的瀏覽器。
 * 回傳的欄位有變動時,要一起更新 components/SharedItemsSection.tsx 給分享者看的「對方看得到 / 保密」清單。
 */
export async function getIncomingShares(email: string, period: string): Promise<IncomingShare[]> {
  const shares = await Share.find({ targetEmail: email.toLowerCase() })
    .populate<{ owner: UserDoc | null }>("owner")
    .sort({ createdAt: -1 });

  // 分享者已刪除帳號的分享直接略過;同一個分享者只取一筆
  // (舊資料一個項目存一筆,遷移合併前同一個人可能有好幾筆,不去重的話金額會重複計算)
  const seenOwners = new Set<string>();
  const valid = shares.filter((s) => {
    if (!s.owner) return false;
    const ownerId = s.owner._id.toString();
    if (seenOwners.has(ownerId)) return false;
    seenOwners.add(ownerId);
    return true;
  });
  const ownerIds = valid.map((s) => s.owner!._id.toString());
  const data = await loadMonthData(ownerIds, [period]);

  return valid.map((s) => {
    const ownerId = s.owner!._id.toString();
    const month = monthDataFor(data, ownerId, period);
    const summary = summarizeMonthData(month);
    return {
      _id: s._id.toString(),
      ownerEmail: s.owner!.email,
      included: s.included,
      income: summary.income,
      expense: summary.expense,
      utility: summary.utility,
      utilityDetail: month.utility
        ? {
            date: month.utility.date ?? 1,
            rent: month.utility.rent ?? 0,
            elec: { ...EMPTY_METER, ...month.utility.elec },
            water: { ...EMPTY_METER, ...month.utility.water },
            rentEnabled: month.utility.rentEnabled !== false,
            elecEnabled: month.utility.elecEnabled !== false,
            waterEnabled: month.utility.waterEnabled !== false,
            enabled: month.utility.enabled !== false,
          }
        : null,
      transactions: month.transactions.map((t) => ({
        type: t.type,
        date: t.date.toISOString(),
        category: t.category,
        kind: kindOf(t),
        amount: netAmount(t),
        isSubscription: !!t.subscription,
      })),
    };
  });
}
