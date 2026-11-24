import mongoose, { Schema, type InferSchemaType } from "mongoose";

const CardSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    // 簽帳金融卡:直接從帳戶扣款,沒有結帳日 / 繳款日,歸屬月份邏輯等同現金
    isDebit: { type: Boolean, default: false },
    closingDate: {
      type: Number,
      required: function (this: { isDebit?: boolean }) {
        return !this.isDebit;
      },
      min: 1,
      max: 31,
    },
    paymentDate: {
      type: Number,
      required: function (this: { isDebit?: boolean }) {
        return !this.isDebit;
      },
      min: 1,
      max: 31,
    },
    // 自訂圖示:16 × 16 像素畫,256 個 0-f 的色號字串(lib/cardPattern.ts);沒有就用預設的信用卡圖示
    pattern: { type: String, match: /^[0-9a-f]{256}$/ },
  },
  { timestamps: true }
);

CardSchema.index({ user: 1 });

export type Card = InferSchemaType<typeof CardSchema> & { _id: mongoose.Types.ObjectId };

export default (mongoose.models.Card as mongoose.Model<InferSchemaType<typeof CardSchema>>) ||
  mongoose.model("Card", CardSchema);
