import { guessKind, type Sense } from "../schemas";
import type { EntryInput } from "../store/types";
import type { DictRecord } from "./types";

export const DICT_DATASET = "Wiktionary (kaikki.org)";
export const DICT_LICENSE = "CC BY-SA 4.0";

let seq = 0;
const localId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** 「タグ付き定義」のラベルを日本語に */
const TAG_JA: Record<string, string> = {
  slang: "スラング",
  colloquial: "口語",
  informal: "くだけた表現",
  Internet: "ネット用語",
  vulgar: "下品な表現",
  offensive: "侮辱的",
  derogatory: "軽蔑的",
  pejorative: "軽蔑的",
  ethnic: "民族的な侮辱",
  slur: "差別語",
  US: "アメリカ",
  "General-American": "アメリカ",
  UK: "イギリス",
  British: "イギリス",
  "Received-Pronunciation": "イギリス",
  Ireland: "アイルランド",
  Irish: "アイルランド",
  Australia: "オーストラリア",
  Australian: "オーストラリア",
};
export function tagLabel(tag: string): string {
  return TAG_JA[tag] ?? tag;
}

/**
 * 収録辞書の1語を、単語帳に登録する形に変える。
 * 元データに無い項目は空のまま（日本語訳を作らない・例文の日本語訳も空）。
 */
export function dictRecordToEntry(rec: DictRecord): EntryInput {
  const senses: Sense[] = rec.pos.slice(0, 20).map((b) => {
    const meaningJa = (b.ja?.length ? b.ja : (b.jaTr ?? [])).slice(0, 3).join("／").slice(0, 300);
    const first = b.defs[0];
    return {
      id: localId("s"),
      pos: b.p,
      meaningJa,
      definitionEn: (first?.en ?? "").slice(0, 500),
      examples: b.defs
        .filter((d) => d.ex)
        .slice(0, 3)
        .map((d) => ({
          id: localId("x"),
          en: d.ex!,
          ja: "",
          cefr: null,
          source: { type: "dictionary" as const, dataset: DICT_DATASET, license: DICT_LICENSE },
        })),
      note: b.defs
        .slice(1)
        .map((d) => `・${d.en}`)
        .join("\n")
        .slice(0, 1000),
    };
  });
  const cautions = (rec.caution ?? []).map(tagLabel);
  return {
    kind: guessKind(rec.w),
    headword: rec.w,
    ipa: rec.ipa?.us ?? rec.ipa?.uk ?? rec.ipa?.any ?? "",
    cefr: rec.cefr ?? null,
    senses,
    synonyms: (rec.syn ?? []).slice(0, 30),
    antonyms: (rec.ant ?? []).slice(0, 30),
    alternatives: [],
    related: [],
    registers: rec.reg ?? [],
    regions: rec.rgn ?? [],
    usageNote: cautions.length ? `使う場面に注意: ${[...new Set(cautions)].join("・")}` : "",
    tags: ["辞書から登録"],
    note: `出典: Wiktionary（${DICT_LICENSE}） https://en.wiktionary.org/wiki/${encodeURIComponent(rec.w)}`,
    source: { type: "dictionary", dataset: DICT_DATASET, license: DICT_LICENSE },
  };
}
