import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * 頻率限制計數(lib/rateLimit.ts):寄信、登入失敗等依 key 計數,例如 "mail:hour:<email>"、"login:fail:<email>:<ip>"。
 * 存在資料庫而不是記憶體,部署在多台機器(serverless)也有效;expiresAt 有 TTL 索引,過期紀錄由 MongoDB 自動刪除
 * (刪除會有最多約 1 分鐘的延遲,所以讀取端一律自己再判斷一次 expiresAt)。
 */
const RateLimitSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true },
});

RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RateLimit = InferSchemaType<typeof RateLimitSchema> & { _id: mongoose.Types.ObjectId };

export default (mongoose.models.RateLimit as mongoose.Model<InferSchemaType<typeof RateLimitSchema>>) ||
  mongoose.model("RateLimit", RateLimitSchema);
