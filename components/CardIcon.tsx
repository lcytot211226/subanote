import { PATTERN_SIZE, patternRuns } from "@/lib/cardPattern";
import { CreditCardIcon } from "./icons";

/** 16 × 16 像素畫圖示(lib/cardPattern.ts 的格式),crispEdges 讓任何尺寸都保持銳利。 */
export function PixelIcon({ pattern, className }: { pattern: string; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${PATTERN_SIZE} ${PATTERN_SIZE}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
    >
      {patternRuns(pattern).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.color} />
      ))}
    </svg>
  );
}

/**
 * 卡片圖示:有自訂像素圖就畫像素圖,否則是預設的信用卡圖示(簽帳金融卡塗成紫色,同 /overview)。
 * `className` 只放尺寸等共用的 class。
 */
export default function CardIcon({
  card,
  className = "h-3.5 w-3.5",
}: {
  card: { isDebit?: boolean | null; pattern?: string | null };
  className?: string;
}) {
  if (card.pattern) return <PixelIcon pattern={card.pattern} className={`shrink-0 ${className}`} />;
  if (card.isDebit) {
    // CSS 的 fill 會蓋過 svg 上的 fill="none"
    return (
      <span title="簽帳金融卡" className="shrink-0">
        <CreditCardIcon
          className={`${className} fill-violet-100 text-violet-600 dark:fill-violet-900/60 dark:text-violet-400`}
        />
      </span>
    );
  }
  return <CreditCardIcon className={`shrink-0 ${className}`} />;
}
