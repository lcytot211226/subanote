/**
 * 信用卡自訂圖示:16 × 16 像素畫,存成 256 個字元的字串(一列接一列,由上到下、由左到右),
 * 每個字元是調色盤色號 0-f,0 = 透明。沒有圖示的卡片 `pattern` 不存在,畫面上沿用預設的信用卡圖示。
 */

export const PATTERN_SIZE = 16;
export const PATTERN_LENGTH = PATTERN_SIZE * PATTERN_SIZE;

/** 調色盤:色號 → 顏色;0 是透明(不畫)。改顏色會讓所有卡片的圖示一起變。 */
export const PALETTE: readonly (string | null)[] = [
  null, // 0 透明
  "#18181b", // 1 黑
  "#ffffff", // 2 白
  "#a1a1aa", // 3 灰
  "#ef4444", // 4 紅
  "#f97316", // 5 橘
  "#facc15", // 6 黃
  "#22c55e", // 7 綠
  "#14b8a6", // 8 青
  "#3b82f6", // 9 藍
  "#1e3a8a", // a 深藍
  "#8b5cf6", // b 紫
  "#ec4899", // c 粉紅
  "#92400e", // d 咖啡
  "#fde68a", // e 淺金
  "#52525b", // f 深灰
];

const PATTERN_RE = /^[0-9a-f]{256}$/;

export const EMPTY_PATTERN = "0".repeat(PATTERN_LENGTH);

/** 合法的圖示字串(256 個 0-f)。 */
export function isValidPattern(value: unknown): value is string {
  return typeof value === "string" && PATTERN_RE.test(value);
}

/**
 * API 收到的 pattern:undefined = 不改;null、空字串或整張透明 = 清除(回到預設圖示);
 * 其他不合法的值回傳 error。
 */
export function parsePattern(value: unknown): { value: string | null | undefined } | { error: string } {
  if (value === undefined) return { value: undefined };
  if (value === null || value === "") return { value: null };
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (isValidPattern(normalized)) return { value: normalized === EMPTY_PATTERN ? null : normalized };
  }
  return { error: "卡片圖示格式不正確" };
}

/** 同一列連續同色的格子合併成一段,畫 SVG 時少很多個 rect。 */
export function patternRuns(pattern: string): { x: number; y: number; w: number; color: string }[] {
  const runs: { x: number; y: number; w: number; color: string }[] = [];
  for (let y = 0; y < PATTERN_SIZE; y++) {
    let x = 0;
    while (x < PATTERN_SIZE) {
      const ch = pattern[y * PATTERN_SIZE + x];
      let end = x + 1;
      while (end < PATTERN_SIZE && pattern[y * PATTERN_SIZE + end] === ch) end++;
      const color = PALETTE[parseInt(ch, 16)];
      if (color) runs.push({ x, y, w: end - x, color });
      x = end;
    }
  }
  return runs;
}

// ---- 模板 ----
// 模板只是起始圖:套用時把像素複製進編輯器,存下來的永遠是像素字串,不記得來自哪個模板。
// 用 16 行文字畫,`.` = 透明,其他字元是色號。

function fromRows(rows: string[]): string {
  const pattern = rows.join("").replaceAll(".", "0");
  if (!isValidPattern(pattern)) throw new Error("invalid card pattern template");
  return pattern;
}

/** 卡片外形:O 外框、B 卡身、C/c 晶片、D 卡號、L/M 右下角的兩個圓 */
const CARD_ROWS = [
  "................",
  "................",
  "................",
  ".OOOOOOOOOOOOOO.",
  "OBBBBBBBBBBBBBBO",
  "OBCCCBBBBBBBBBBO",
  "OBCcCBBBBBBBBBBO",
  "OBBBBBBBBBBBBBBO",
  "OBDDBDDBDDBDDBBO",
  "OBBBBBBBBBBBBBBO",
  "OBBBBBBBBBLLMMBO",
  "OBBBBBBBBBBBBBBO",
  ".OOOOOOOOOOOOOO.",
  "................",
  "................",
  "................",
];

type CardColors = { O?: string; B: string; C: string; c: string; D: string; L: string; M: string };

/** 外框預設黑色(色號 1) */
function cardTemplate(colors: CardColors): string {
  const map = { O: "1", ...colors };
  return fromRows(CARD_ROWS.map((row) => row.replace(/[OBCcDLM]/g, (k) => map[k as keyof CardColors]!)));
}

/** 卡片外形,卡身改成斜向彩虹條紋 */
function rainbowCard(): string {
  const stripes = ["4", "5", "6", "7", "9", "b"];
  return fromRows(
    CARD_ROWS.map((row, y) =>
      [...row]
        .map((ch, x) => {
          if (ch === ".") return ".";
          if (ch === "O") return "1";
          if (ch === "C") return "e";
          if (ch === "c") return "6";
          return stripes[Math.floor((x + y) / 3) % stripes.length];
        })
        .join("")
    )
  );
}

export const PATTERN_TEMPLATES: { name: string; pattern: string }[] = [
  { name: "經典藍", pattern: cardTemplate({ B: "9", C: "e", c: "6", D: "2", L: "4", M: "6" }) },
  { name: "金卡", pattern: cardTemplate({ B: "6", C: "e", c: "d", D: "d", L: "5", M: "d" }) },
  // 黑卡的卡身本來就是黑色,外框改深灰才看得出輪廓
  { name: "黑卡", pattern: cardTemplate({ O: "f", B: "1", C: "e", c: "6", D: "3", L: "3", M: "f" }) },
  { name: "粉紅", pattern: cardTemplate({ B: "c", C: "e", c: "6", D: "2", L: "2", M: "b" }) },
  { name: "彩虹", pattern: rainbowCard() },
  {
    name: "愛心",
    pattern: fromRows([
      "................",
      "................",
      "..4444....4444..",
      ".444444..444444.",
      "4422444444444444",
      "4424444444444444",
      "4444444444444444",
      "4444444444444444",
      ".44444444444444.",
      "..444444444444..",
      "...4444444444...",
      "....44444444....",
      ".....444444.....",
      "......4444......",
      ".......44.......",
      "................",
    ]),
  },
  {
    name: "星星",
    pattern: fromRows([
      ".......66.......",
      ".......66.......",
      "......6666......",
      "......6666......",
      ".....666666.....",
      "6666666666666666",
      ".66666666666666.",
      "..666666666666..",
      "...6666666666...",
      "....66666666....",
      "....66666666....",
      "...6666666666...",
      "...6666..6666...",
      "..6666....6666..",
      "..666......666..",
      ".66..........66.",
    ]),
  },
  {
    name: "貓咪",
    pattern: fromRows([
      "................",
      ".5............5.",
      ".55..........55.",
      ".5c5........5c5.",
      ".5cc55555555cc5.",
      ".55555555555555.",
      "5555555555555555",
      "5551155555511555",
      "5551155555511555",
      "5555555555555555",
      "5555555cc5555555",
      "5555551551555555",
      "5555555115555555",
      ".55555555555555.",
      "..555555555555..",
      "....55555555....",
    ]),
  },
];
