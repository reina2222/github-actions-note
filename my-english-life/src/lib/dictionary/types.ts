import type { CefrLevel, PartOfSpeech, Region, Register } from "../schemas";

/* ==================================================================
 * 収録辞書（public/dict/）のデータ形式
 * 作り方は scripts/dict/build-dictionary.mjs を参照。
 * 元データに無い項目は「キーごと無い」。アプリ側で作らない。
 * ================================================================== */

export type DictDefinition = {
  en: string;
  /** slang / informal / US など（Wiktionary のラベル） */
  tags?: string[];
  /** 作例（Wiktionary の usage example）。日本語訳は収録していない */
  ex?: string;
};

export type DictPosBlock = {
  p: PartOfSpeech;
  defs: DictDefinition[];
  /** 日本語版 Wiktionary の語義 */
  ja?: string[];
  /** 英語版 Wiktionary の翻訳表にある日本語の訳語 */
  jaTr?: string[];
};

export type DictRecord = {
  w: string;
  pos: DictPosBlock[];
  ipa?: { us?: string; uk?: string; any?: string };
  cefr?: CefrLevel;
  cefrSrc?: string;
  syn?: string[];
  ant?: string[];
  reg?: Register[];
  rgn?: Region[];
  /** vulgar / offensive など、使う場面に注意が必要なラベル */
  caution?: string[];
};

/** 検索用の一覧の1行: [見出し語, CEFR（無ければ ""）, 品詞コード, 短い日本語（無ければ ""）] */
export type DictRow = [string, string, string, string];
export type DictIndex = { v: string; rows: DictRow[] };

export type DictSource = {
  name: string;
  via: string;
  url: string;
  license: string;
  licenseUrl?: string;
  use: string;
};

export type DictMeta = {
  version: string;
  builtAt: string;
  count: number;
  target: number;
  shards: string[];
  stats: Record<string, number>;
  cefr: Record<string, number>;
  sources: DictSource[];
  changes: string;
};

export const POS_FROM_CODE: Record<string, PartOfSpeech> = {
  n: "noun",
  v: "verb",
  a: "adjective",
  r: "adverb",
  p: "pronoun",
  e: "preposition",
  c: "conjunction",
  i: "interjection",
  d: "determiner",
  h: "phrase",
  m: "idiom",
  o: "other",
};

/* ---------- 英検の目安 ----------
 * 英検に公式の語彙リストは無いため、日本英語検定協会が公表している各級の CEFR 対応
 * （3級=A1 / 準2級=A2 / 2級=B1 / 準1級=B2 / 1級=C1）で、CEFR から換算した「学習上の目安」。
 * 出題の保証ではない。CEFR が未設定の語は英検の目安も未設定。
 */
export const EIKEN_GRADES = ["3", "p2", "2", "p1", "1"] as const;
export type EikenGrade = (typeof EIKEN_GRADES)[number];
export const EIKEN_LABELS: Record<EikenGrade, string> = {
  "3": "英検3級",
  p2: "英検準2級",
  "2": "英検2級",
  p1: "英検準1級",
  "1": "英検1級",
};

export function eikenFromCefr(cefr: string | null | undefined): EikenGrade | null {
  switch (cefr) {
    case "A1":
      return "3";
    case "A2":
      return "p2";
    case "B1":
      return "2";
    case "B2":
      return "p1";
    case "C1":
    case "C2":
      return "1";
    default:
      return null;
  }
}

export function eikenLabel(cefr: string | null | undefined): string | null {
  const g = eikenFromCefr(cefr);
  if (!g) return null;
  return cefr === "C2" ? "英検1級以上" : EIKEN_LABELS[g];
}
