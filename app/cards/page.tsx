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
  }));

  const planDTOs: RewardPlanDTO[] = plans.map((plan) => ({
    _id: plan._id.toString(),
    name: plan.name,
    terms: plan.terms.map((t) => ({ rate: t.rate, rounding: t.rounding })),
    colorIndex: plan.colorIndex,
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">信用卡管理</h1>
      <CardForm initialCards={cardDTOs} />
      <RewardCalculator initialPlans={planDTOs} />
    </div>
  );
}
