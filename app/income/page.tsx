import { Suspense } from "react";
import { connectToDatabase } from "@/lib/mongodb";
import Card from "@/lib/models/Card";
import TransactionsClient from "@/components/TransactionsClient";
import type { CardDTO } from "@/components/CardForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const auth = await getCurrentUser();
  await connectToDatabase();
  const cards = await Card.find({ user: auth!.userId }).sort({ createdAt: 1 }).lean();
  const cardDTOs: CardDTO[] = cards.map((card) => ({
    _id: card._id.toString(),
    name: card.name,
    isDebit: !!card.isDebit,
    closingDate: card.closingDate ?? null,
    paymentDate: card.paymentDate ?? null,
  }));

  return (
    // 新增面板打開時(TransactionsClient 的 aside[data-add-panel])把版面加寬一個面板的寬度,
    // 列表維持原本寬度、面板接在右邊,而不是在 max-w-4xl 裡互相擠
    <div className="mx-auto max-w-4xl px-4 py-8 lg:has-[[data-add-panel]]:max-w-[79.5rem]">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">收入總覽</h1>
      <Suspense fallback={null}>
        <TransactionsClient type="income" initialCards={cardDTOs} />
      </Suspense>
    </div>
  );
}
