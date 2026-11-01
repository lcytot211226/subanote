import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { ROUNDINGS } from "../rewardPlan";

/** 信用卡回饋試算的方案(見 lib/rewardPlan.ts),每個使用者最多 8 個。 */
const RewardPlanSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    terms: {
      type: [
        new Schema(
          {
            rate: { type: Number, required: true, min: 0, max: 100 }, // 回饋率(%)
            rounding: { type: String, enum: ROUNDINGS, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    // 圖表顏色槽位(0-7),新增時取第一個沒被用到的,之後不變
    colorIndex: { type: Number, required: true, min: 0, max: 7 },
  },
  { timestamps: true }
);

RewardPlanSchema.index({ user: 1 });

export type RewardPlan = InferSchemaType<typeof RewardPlanSchema> & { _id: mongoose.Types.ObjectId };

export default (mongoose.models.RewardPlan as mongoose.Model<InferSchemaType<typeof RewardPlanSchema>>) ||
  mongoose.model("RewardPlan", RewardPlanSchema);
