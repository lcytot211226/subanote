import OverviewSummary from "@/lib/models/OverviewSummary";
import { recomputeOverviewSummary } from "@/lib/recomputeOverviewSummary";

/**
 * 讀某使用者某個月的 OverviewSummary 快取;還沒有快取就現場算一次並補上。
 */
export async function getOverviewSummary(userId: string, period: string) {
  const summary = await OverviewSummary.findOne({ user: userId, period });
  if (summary) return summary;
  return recomputeOverviewSummary(userId, period);
}
