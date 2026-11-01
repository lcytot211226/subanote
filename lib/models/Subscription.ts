import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { EXPENSE_KINDS, DEFAULT_EXPENSE_KIND } from "../expenseKind";

const SubscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    item: { type: String, required: true },
    amount: { type: Number, required: true },
    /** 支出分類(見 lib/expenseKind.ts),之後生成的每一期交易都沿用這個分類;已生成的不會跟著改。 */
    kind: { type: String, enum: EXPENSE_KINDS, default: DEFAULT_EXPENSE_KIND },
    category: { type: String, enum: ["cash", "credit_card"], required: true },
    card: { type: Schema.Types.ObjectId, ref: "Card", default: null },
    // 首次扣款日期,之後每月同一天(遇短月自動夾到月底)重複扣款。
    startDate: { type: Date, required: true },
    // 已經生成到哪一次扣款日,避免重複生成;編輯/刪除訂閱都不會回頭動已生成的交易。
    lastGeneratedDate: { type: Date, default: null },
  },
  { timestamps: true }
);

SubscriptionSchema.index({ user: 1 });

export type Subscription = InferSchemaType<typeof SubscriptionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export default (mongoose.models.Subscription as mongoose.Model<
  InferSchemaType<typeof SubscriptionSchema>
>) || mongoose.model("Subscription", SubscriptionSchema);
