"use client";

import { Suspense, useCallback, useState } from "react";
import type { CardDTO } from "./CardForm";
import SubscriptionsClient, { type SubscriptionDTO } from "./SubscriptionsClient";
import SubscriptionForm from "./SubscriptionForm";
import TransactionsClient from "./TransactionsClient";

export default function ExpenseClient({
  initialCards,
  initialSubscriptions,
}: {
  initialCards: CardDTO[];
  initialSubscriptions: SubscriptionDTO[];
}) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);

  // 訂閱新增/編輯/刪除後:重新讀取訂閱清單,並讓交易列表重抓(可能補生成了新的訂閱交易)
  const handleSubscriptionsChanged = useCallback(async () => {
    setRefreshToken((n) => n + 1);
    const res = await fetch("/api/subscriptions");
    if (!res.ok) return;
    const data = await res.json();
    setSubscriptions(data.subscriptions ?? []);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <TransactionsClient
          type="expense"
          initialCards={initialCards}
          refreshToken={refreshToken}
          actions={
            <SubscriptionsClient
              cards={initialCards}
              subscriptions={subscriptions}
              onChanged={handleSubscriptionsChanged}
            />
          }
          addAlternative={{
            label: "訂閱",
            render: (close) => (
              <SubscriptionForm
                cards={initialCards}
                onSaved={() => {
                  close();
                  handleSubscriptionsChanged();
                }}
                onCancel={close}
              />
            ),
          }}
        />
      </Suspense>
    </div>
  );
}
