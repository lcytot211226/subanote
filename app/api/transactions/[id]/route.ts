import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Transaction from "@/lib/models/Transaction";
import Card from "@/lib/models/Card";
import { requireAuth } from "@/lib/auth";
import { calculateBillingPeriod, toCardBillingInfo } from "@/lib/calculateBillingPeriod";
import { parsePointsDiscount } from "@/lib/pointsDiscount";
import { DEFAULT_KIND, isKindFor } from "@/lib/transactionKind";
import { anchorFromPeriod, installmentDate } from "@/lib/installmentDates";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;
  await connectToDatabase();
  const transaction = await Transaction.findOne({ _id: id, user: auth.userId }).populate("card");
  if (!transaction) {
    return NextResponse.json({ error: "找不到交易紀錄" }, { status: 404 });
  }
  return NextResponse.json({ transaction });
}

export async function PUT(request: Request, { params }: Context) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { type, date, category, item, card, installmentInfo, amount, posted, pointsDiscount, kind } = body;

  await connectToDatabase();
  const existing = await Transaction.findOne({ _id: id, user: auth.userId });
  if (!existing) {
    return NextResponse.json({ error: "找不到交易紀錄" }, { status: 404 });
  }

  const finalCategory = category ?? existing.category;
  let finalDate = date ? new Date(date) : existing.date;
  let finalPosted = posted ?? existing.posted;
  const finalCard = category === "cash" ? null : (card ?? existing.card);

  let cardBillingInfo = null;
  if (finalCategory !== "cash") {
    if (!finalCard) {
      return NextResponse.json({ error: "信用卡/分期交易需要指定卡片" }, { status: 400 });
    }
    const cardDoc = await Card.findOne({ _id: finalCard, user: auth.userId });
    if (!cardDoc) {
      return NextResponse.json({ error: "找不到卡片" }, { status: 404 });
    }
    cardBillingInfo = toCardBillingInfo(cardDoc);
  }

  // 分期整組一起改(跟刪除一樣):日期、入帳狀態、卡片、項目、分類套用到同一組每一期,金額只改這一期。
  const groupId = finalCategory === "installment" ? existing.installmentGroupId : null;
  let groupUpdates: { _id: unknown; date: Date; billingPeriod: string }[] = [];
  if (groupId) {
    // 簽帳金融卡沒有結帳日,一律視為已入帳
    if (cardBillingInfo?.isDebit) finalPosted = true;
    const group = await Transaction.find({ user: auth.userId, installmentGroupId: groupId });
    const k = existing.installmentInfo?.currentNumber ?? 1;
    const oldShift = existing.posted ? 0 : 1;
    const newShift = finalPosted ? 0 : 1;
    const dateChanged = finalDate.getTime() !== existing.date.getTime();
    // 日期或入帳狀態有變才重排整組日期;否則保留各期原本的日期,只重算歸屬月份(卡片可能換了)
    const redate = dateChanged || oldShift !== newShift;
    let anchor = anchorFromPeriod(finalDate, k, oldShift);
    if (!dateChanged) {
      // 沒改日期:錨點的「幾號」取整組最大的那天,還原被短月夾到月底的日期(例如 1/31、2/28、3/31)
      const first = group.find((t) => t.installmentInfo?.currentNumber === 1) ?? existing;
      anchor = {
        ...anchorFromPeriod(first.date, first.installmentInfo?.currentNumber ?? 1, oldShift),
        day: Math.max(...group.map((t) => t.date.getUTCDate())),
      };
    }
    groupUpdates = group.map((t) => {
      const n = t.installmentInfo?.currentNumber ?? 1;
      const d = redate ? installmentDate(anchor, n - 1, newShift) : t.date;
      return { _id: t._id, date: d, billingPeriod: calculateBillingPeriod(d, "installment", finalPosted, cardBillingInfo) };
    });
    const self = groupUpdates.find((u) => String(u._id) === String(existing._id));
    if (self) finalDate = self.date;
  }

  const billingPeriod = calculateBillingPeriod(finalDate, finalCategory, finalPosted, cardBillingInfo);

  const finalType = type ?? existing.type;
  const finalAmount = amount ?? existing.amount;
  // 沒帶 pointsDiscount 就沿用原本的值(若改成不適用的付款方式/類型,會在這裡被清掉)
  const discount = parsePointsDiscount(pointsDiscount === undefined ? existing.pointsDiscount : pointsDiscount, {
    type: finalType,
    category: finalCategory,
    amount: Number(finalAmount),
  });
  if ("error" in discount) {
    return NextResponse.json({ error: discount.error }, { status: 400 });
  }

  // 分類:有帶就要符合這筆的收支類型;沒帶就沿用原本的值(收支類型改了、原分類對不上時改成「其他」)
  if (kind != null && !isKindFor(finalType, kind)) {
    return NextResponse.json({ error: "分類不正確" }, { status: 400 });
  }
  const finalKind = kind ?? (isKindFor(finalType, existing.kind) ? existing.kind : DEFAULT_KIND);
  const unset: Record<string, 1> = {};
  if (discount.value == null) unset.pointsDiscount = 1;

  const transaction = await Transaction.findOneAndUpdate(
    { _id: id, user: auth.userId },
    {
      type: finalType,
      kind: finalKind,
      date: finalDate,
      category: finalCategory,
      item: item ?? existing.item,
      card: finalCard,
      installmentInfo: finalCategory === "installment" ? (installmentInfo ?? existing.installmentInfo) : null,
      amount: finalAmount,
      // 沒有折抵就把欄位整個移除,而不是存 0
      ...(discount.value != null ? { pointsDiscount: discount.value } : {}),
      ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      posted: finalPosted,
      billingPeriod,
      // 改成非分期就跟原本那組分期脫鉤,避免之後誤刪到其他期數。
      installmentGroupId: groupId,
    },
    { new: true, runValidators: true }
  ).populate("card");

  // 同一組的其他期數:項目、分類、卡片、入帳狀態跟著改,日期 / 歸屬月份用上面整組重排的結果(金額不動)
  if (groupId) {
    const others = groupUpdates.filter((u) => String(u._id) !== String(existing._id));
    if (others.length > 0) {
      await Transaction.bulkWrite(
        others.map((u) => ({
          updateOne: {
            filter: { _id: u._id, user: auth.userId },
            update: {
              $set: {
                date: u.date,
                billingPeriod: u.billingPeriod,
                item: transaction?.item,
                kind: finalKind,
                card: finalCard,
                posted: finalPosted,
              },
            },
          },
        }))
      );
    }
    const groupTransactions = await Transaction.find({ user: auth.userId, installmentGroupId: groupId }).populate(
      "card"
    );
    return NextResponse.json({ transaction, groupTransactions });
  }

  return NextResponse.json({ transaction });
}

export async function DELETE(_request: Request, { params }: Context) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;
  await connectToDatabase();
  const existing = await Transaction.findOne({ _id: id, user: auth.userId });
  if (!existing) {
    return NextResponse.json({ error: "找不到交易紀錄" }, { status: 404 });
  }

  // 分期交易(有 installmentGroupId)刪除時,同一組的所有期數要一起刪掉。
  if (existing.installmentGroupId) {
    const result = await Transaction.deleteMany({
      user: auth.userId,
      installmentGroupId: existing.installmentGroupId,
    });
    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  }

  await Transaction.deleteOne({ _id: id, user: auth.userId });
  return NextResponse.json({ success: true, deletedCount: 1 });
}
