import mongoose, { Schema, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createDate: { type: Date, required: true, default: Date.now },
    specialDate: { type: Number, min: 1, max: 31 },
    emailVerified: { type: Boolean, required: true, default: false },
    /** 註冊啟用 / 忘記密碼共用的 6 碼驗證碼(bcrypt hash 過),驗證成功或過期後清空。 */
    verificationCodeHash: { type: String, default: null },
    verificationCodeExpires: { type: Date, default: null },
    /** 目前這組驗證碼已經輸錯 / 嘗試幾次,到上限(lib/security.ts 的 OTP_MAX_ATTEMPTS)就作廢;寄出新驗證碼時歸零。舊資料沒有視為 0。 */
    verificationAttempts: { type: Number, default: 0 },
    /** 登入狀態版本號:放進登入 token(ver),改密碼 / 重設密碼 / 登出所有裝置時 +1,讓舊 token 失效。舊資料沒有視為 0。 */
    tokenVersion: { type: Number, default: 0 },
    // 是否已讀最新的系統通知。發布新公告時,所有使用者這個欄位會被統一重置為 false(未讀)。
    notificationRead: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

// 後台使用者清單(新到舊分頁)與「近 30 天加入人數」用
UserSchema.index({ createDate: -1 });

export type User = InferSchemaType<typeof UserSchema> & { _id: mongoose.Types.ObjectId };

export default (mongoose.models.User as mongoose.Model<InferSchemaType<typeof UserSchema>>) ||
  mongoose.model("User", UserSchema);
