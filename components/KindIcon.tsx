import { KIND_LABEL, type TransactionKind } from "@/lib/transactionKind";
import {
  ArrowsRightLeftIcon,
  BookIcon,
  BriefcaseIcon,
  CarIcon,
  EllipsisIcon,
  FoodIcon,
  GamepadIcon,
  GiftIcon,
  MedicalIcon,
  ShoppingBagIcon,
  SportIcon,
} from "./icons";

export const KIND_ICON: Record<TransactionKind, typeof FoodIcon> = {
  // 支出
  food: FoodIcon,
  entertainment: GamepadIcon,
  shop: ShoppingBagIcon,
  transport: CarIcon,
  medical: MedicalIcon,
  learning: BookIcon,
  sport: SportIcon,
  // 收入
  salary: BriefcaseIcon,
  bonus: GiftIcon,
  transfer: ArrowsRightLeftIcon,
  // 共用
  other: EllipsisIcon,
};

/** 圓底色 + 圖示顏色,淺色 / 深色模式各一組。 */
export const KIND_COLOR: Record<TransactionKind, string> = {
  food: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400",
  entertainment: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  shop: "bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400",
  transport: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
  medical: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  learning: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  sport: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400",
  salary: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  bonus: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  transfer: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  other: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
};

/** 圖表(長條、圓環)用的實色,跟上面圖示的顏色同色系;淺色 / 深色模式各一組。 */
export const KIND_FILL: Record<TransactionKind, { bar: string; stroke: string }> = {
  food: { bar: "bg-orange-500 dark:bg-orange-400", stroke: "stroke-orange-500 dark:stroke-orange-400" },
  entertainment: { bar: "bg-violet-500 dark:bg-violet-400", stroke: "stroke-violet-500 dark:stroke-violet-400" },
  shop: { bar: "bg-pink-500 dark:bg-pink-400", stroke: "stroke-pink-500 dark:stroke-pink-400" },
  transport: { bar: "bg-sky-500 dark:bg-sky-400", stroke: "stroke-sky-500 dark:stroke-sky-400" },
  medical: { bar: "bg-red-500 dark:bg-red-400", stroke: "stroke-red-500 dark:stroke-red-400" },
  learning: { bar: "bg-amber-500 dark:bg-amber-400", stroke: "stroke-amber-500 dark:stroke-amber-400" },
  sport: { bar: "bg-teal-500 dark:bg-teal-400", stroke: "stroke-teal-500 dark:stroke-teal-400" },
  salary: { bar: "bg-emerald-500 dark:bg-emerald-400", stroke: "stroke-emerald-500 dark:stroke-emerald-400" },
  bonus: { bar: "bg-yellow-500 dark:bg-yellow-400", stroke: "stroke-yellow-500 dark:stroke-yellow-400" },
  transfer: { bar: "bg-blue-500 dark:bg-blue-400", stroke: "stroke-blue-500 dark:stroke-blue-400" },
  other: { bar: "bg-zinc-400 dark:bg-zinc-500", stroke: "stroke-zinc-400 dark:stroke-zinc-500" },
};

export default function KindIcon({
  kind,
  size = "md",
  className = "",
}: {
  kind: TransactionKind;
  /** md:列表 / 表單用;sm:下拉選單、圖表裡的小圖示 */
  size?: "sm" | "md";
  className?: string;
}) {
  const Icon = KIND_ICON[kind];
  return (
    <span
      title={KIND_LABEL[kind]}
      className={`flex shrink-0 items-center justify-center rounded-full ${size === "sm" ? "h-6 w-6" : "h-9 w-9"} ${KIND_COLOR[kind]} ${className}`}
    >
      <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
      <span className="sr-only">{KIND_LABEL[kind]}</span>
    </span>
  );
}
