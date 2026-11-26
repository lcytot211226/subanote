/** 搜尋字串可用半形 / 全形逗號或頓號分隔多個關鍵字,名稱包含任一個就算符合(不分大小寫)。 */
export function parseKeywords(search: string): string[] {
  return [
    ...new Set(
      search
        .split(/[,，、]/)
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

/** 把關鍵字當成純文字放進正規表示式(跳脫 . * ( 等特殊字元) */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
