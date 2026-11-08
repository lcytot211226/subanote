import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * 使用者把自己的收支資料分享給某個 email(不需要對方已註冊),只有「分享 / 不分享」,不能挑項目。
 * 對方登入後在自己的 /overview 看得到這份資料(交易已去掉品項名稱,見 lib/getIncomingShares.ts),
 * 並自行決定 included 要不要納入自己的收支統計,原始資料仍歸屬分享者。
 */
const ShareSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetEmail: { type: String, required: true },
    included: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

ShareSchema.index({ owner: 1, targetEmail: 1 }, { unique: true });
ShareSchema.index({ targetEmail: 1 });

export type Share = InferSchemaType<typeof ShareSchema> & { _id: mongoose.Types.ObjectId };

export default (mongoose.models.Share as mongoose.Model<InferSchemaType<typeof ShareSchema>>) ||
  mongoose.model("Share", ShareSchema);
