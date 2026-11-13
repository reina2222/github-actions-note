import { z } from "zod";

/* ==================================================================
 * My English Life 2.0 — 単語・フレーズ帳のデータ定義
 * ------------------------------------------------------------------
 * 1つの「項目（Entry）」= 英単語 または 英語フレーズ。
 * 1つの項目に複数の「語義（Sense）」を持てる（例: run =「走る」「経営する」）。
 * 日本語訳・定義・例文などは空欄でも登録できる（未収録のデータを捏造しない）。
 * CEFR は「単語の難易度」と「例文の難易度」を別々に持ち、分からなければ null（＝レベル未設定）。
 * ================================================================== */

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const CEFR_LABELS: Record<CefrLevel, string> = {
  A1: "A1 初級",
  A2: "A2 初中級",
  B1: "B1 中級",
  B2: "B2 中上級",
  C1: "C1 上級",
  C2: "C2 熟達",
};

export const ENTRY_KINDS = ["word", "phrase"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export const ENTRY_KIND_LABELS: Record<EntryKind, string> = { word: "単語", phrase: "フレーズ" };

export const PARTS_OF_SPEECH = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "interjection",
  "determiner",
  "phrase",
  "idiom",
  "other",
] as const;
export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];
export const POS_LABELS: Record<PartOfSpeech, string> = {
  noun: "名詞",
  verb: "動詞",
  adjective: "形容詞",
  adverb: "副詞",
  pronoun: "代名詞",
  preposition: "前置詞",
  conjunction: "接続詞",
  interjection: "間投詞",
  determiner: "限定詞",
  phrase: "句・フレーズ",
  idiom: "イディオム",
  other: "その他",
};

/** 表現の種類（Phase 5 で画面に出す。データだけ先に用意） */
export const REGISTERS = ["standard", "casual", "spoken", "slang", "ellipsis", "contraction", "regional"] as const;
export type Register = (typeof REGISTERS)[number];

export const REGIONS = ["us", "uk", "ie", "au"] as const;
export type Region = (typeof REGIONS)[number];

/** データの出どころ（出典・ライセンスを追跡するため） */
export const sourceSchema = z.object({
  type: z.enum(["user", "dictionary", "migrated"]),
  /** 辞書データの名前・版・ライセンス（type = dictionary のとき） */
  dataset: z.string().optional(),
  version: z.string().optional(),
  license: z.string().optional(),
});
export type Source = z.infer<typeof sourceSchema>;

export const exampleSchema = z.object({
  id: z.string().min(1),
  en: z.string().min(1).max(500),
  /** 日本語訳（未収録なら空） */
  ja: z.string().max(500).default(""),
  /** 例文の難易度。根拠が無ければ null = レベル未設定 */
  cefr: z.enum(CEFR_LEVELS).nullable().default(null),
  source: sourceSchema.default({ type: "user" }),
});
export type Example = z.infer<typeof exampleSchema>;

export const senseSchema = z.object({
  id: z.string().min(1),
  pos: z.enum(PARTS_OF_SPEECH).nullable().default(null),
  /** 日本語の意味（未収録なら空） */
  meaningJa: z.string().max(300).default(""),
  /** 英語の定義（未収録なら空） */
  definitionEn: z.string().max(500).default(""),
  examples: z.array(exampleSchema).max(30).default([]),
  /** この語義の使い方メモ */
  note: z.string().max(1000).default(""),
});
export type Sense = z.infer<typeof senseSchema>;

const wordList = z.array(z.string().min(1).max(100)).max(30).default([]);

export const entrySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(ENTRY_KINDS),
  /** 英単語・英語フレーズ */
  headword: z.string().trim().min(1).max(200),
  /** 発音記号（IPA） */
  ipa: z.string().max(100).default(""),
  /** 単語そのものの難易度（例文の難易度とは別）。null = レベル未設定 */
  cefr: z.enum(CEFR_LEVELS).nullable().default(null),
  senses: z.array(senseSchema).min(1).max(20),
  synonyms: wordList,
  antonyms: wordList,
  alternatives: wordList,
  related: wordList,
  registers: z.array(z.enum(REGISTERS)).default([]),
  regions: z.array(z.enum(REGIONS)).default([]),
  /** スラング等の注意事項（使用場面・失礼になる可能性など） */
  usageNote: z.string().max(1000).default(""),
  tags: z.array(z.string().min(1).max(30)).max(20).default([]),
  note: z.string().max(2000).default(""),
  source: sourceSchema.default({ type: "user" }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Entry = z.infer<typeof entrySchema>;

/** 1つの語義の主な意味（一覧・カード表示用）。日本語が無ければ英語の定義 */
export function primaryMeaning(entry: Pick<Entry, "senses">): string {
  for (const s of entry.senses) if (s.meaningJa.trim()) return s.meaningJa.trim();
  for (const s of entry.senses) if (s.definitionEn.trim()) return s.definitionEn.trim();
  return "";
}

/** 単語かフレーズかの自動判定（空白を含めばフレーズ） */
export function guessKind(headword: string): EntryKind {
  return /\s/.test(headword.trim()) ? "phrase" : "word";
}

/* ---------- 入力 ---------- */

export const INPUT_METHODS = ["text", "voice"] as const;
export type InputMethod = (typeof INPUT_METHODS)[number];
export const ENGLISH_MAX = 200;

/** カンマ・読点・改行区切りの文字列を配列に（類義語などの入力用） */
export function splitList(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[,、，\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, 30);
}
