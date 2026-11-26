import { Suspense } from "react";
import { connectToDatabase } from "@/lib/mongodb";
import Card from "@/lib/models/Card";
import SearchClient from "@/components/SearchClient";
import type { CardDTO } from "@/components/CardForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const auth = await getCurrentUser();
  await connectToDatabase();
  // 搜尋結果可以直接編輯,交易表單要用卡片清單
  const cards = await Card.find({ user: auth!.userId }).sort({ createdAt: 1 }).lean();
  const cardDTOs: CardDTO[] = cards.map((card) => ({
    _id: card._id.toString(),
    name: card.name,
    isDebit: !!card.isDebit,
    closingDate: card.closingDate ?? null,
    paymentDate: card.paymentDate ?? null,
    pattern: card.pattern ?? null,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">搜尋紀錄</h1>
      <Suspense>
        <SearchClient cards={cardDTOs} />
      </Suspense>
    </div>
  );
}
