import type { CefrLevel, PartOfSpeech } from "../schemas";
import { eikenFromCefr, POS_FROM_CODE, type DictRow, type EikenGrade } from "./types";

export type DictFilter = {
  query: string;
  /** "none" = レベル未設定 */
  cefr: CefrLevel | "none" | "all";
  eiken: EikenGrade | "all";
  pos: PartOfSpeech | "all";
  status: "all" | "favorites" | "registered" | "unregistered";
};

export const DEFAULT_FILTER: DictFilter = { query: "", cefr: "all", eiken: "all", pos: "all", status: "all" };

const hasJapanese = (s: string) => /[぀-ヿ㐀-鿿]/.test(s);

/**
 * 収録辞書の検索（端末内で実行。15,000語でも数ミリ秒）
 * 並び順: 完全一致 → 前方一致 → 部分一致。同じ順位の中はアルファベット順。
 * 日本語で入力したときは、短い日本語訳に含まれる語を探す。
 */
export function searchDictionary(
  rows: readonly DictRow[],
  filter: DictFilter,
  ctx: { favorites: ReadonlySet<string>; registered: ReadonlySet<string> },
): DictRow[] {
  const q = filter.query.trim().toLowerCase();
  const ja = hasJapanese(q);
  const exact: DictRow[] = [];
  const prefix: DictRow[] = [];
  const partial: DictRow[] = [];
  for (const row of rows) {
    const [w, cefr, posCodes, jaShort] = row;
    if (filter.cefr !== "all" && (filter.cefr === "none" ? cefr !== "" : cefr !== filter.cefr)) continue;
    if (filter.eiken !== "all" && eikenFromCefr(cefr) !== filter.eiken) continue;
    if (filter.pos !== "all" && ![...posCodes].some((c) => POS_FROM_CODE[c] === filter.pos)) continue;
    if (filter.status === "favorites" && !ctx.favorites.has(w)) continue;
    if (filter.status === "registered" && !ctx.registered.has(w.toLowerCase())) continue;
    if (filter.status === "unregistered" && ctx.registered.has(w.toLowerCase())) continue;
    if (!q) {
      partial.push(row);
      continue;
    }
    if (ja) {
      if (jaShort.toLowerCase().includes(q)) partial.push(row);
      continue;
    }
    const lw = w.toLowerCase();
    if (lw === q) exact.push(row);
    else if (lw.startsWith(q)) prefix.push(row);
    else if (lw.includes(q)) partial.push(row);
  }
  return [...exact, ...prefix, ...partial];
}
