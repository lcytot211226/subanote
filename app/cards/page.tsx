import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons";
import { connectToDatabase } from "@/lib/mongodb";
import Card from "@/lib/models/Card";
import CardForm, { type CardDTO } from "@/components/CardForm";
import { getCurrentUser } from "@/lib/auth";
import RewardPlan from "@/lib/models/RewardPlan";
import RewardCalculator from "@/components/RewardCalculator";
import type { RewardPlanDTO } from "@/lib/rewardPlan";

export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const auth = await getCurrentUser();
  await connectToDatabase();
  const [cards, plans] = await Promise.all([
    Card.find({ user: auth!.userId }).sort({ createdAt: 1 }).lean(),
    RewardPlan.find({ user: auth!.userId }).sort({ createdAt: 1 }).lean(),
  ]);

  const cardDTOs: CardDTO[] = cards.map((card) => ({
    _id: card._id.toString(),
    name: card.name,
    isDebit: !!card.isDebit,
    closingDate: card.closingDate ?? null,
    paymentDate: card.paymentDate ?? null,
    pattern: card.pattern ?? null,
  }));

  const planDTOs: RewardPlanDTO[] = plans.map((plan) => ({
    _id: plan._id.toString(),
    name: plan.name,
    terms: plan.terms.map((t) => ({ rate: t.rate, rounding: t.rounding })),
    colorIndex: plan.colorIndex,
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <div className="flex flex-col gap-3">
        {/* 手機版是從設定頁進來的(底部分頁列沒有信用卡),給一個回設定的返回鈕;桌面版導覽列就有信用卡,不需要 */}
        <Link
          href="/settings"
          className="-ml-1 flex items-center gap-0.5 self-start rounded-md py-1 pr-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 sm:hidden dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          設定
        </Link>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">信用卡管理</h1>
      </div>
      <CardForm initialCards={cardDTOs} />
      <RewardCalculator initialPlans={planDTOs} />
    </div>
  );
}
