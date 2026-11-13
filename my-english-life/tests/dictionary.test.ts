import { describe, expect, it } from "vitest";

import { searchDictionary, DEFAULT_FILTER } from "@/lib/dictionary/search";
import { dictRecordToEntry } from "@/lib/dictionary/to-entry";
import { eikenFromCefr, eikenLabel, type DictRecord, type DictRow } from "@/lib/dictionary/types";
import { shardOf } from "@/lib/dictionary/shard";
import { LocalLearningRepository, type KeyValueStorage } from "@/lib/store/local-repository";

// テスト専用の架空の行（実在の辞書データではない）
const rows: DictRow[] = [
  ["alpha", "A2", "nv", "テスト語A"],
  ["alphabet", "", "n", ""],
  ["lalpha", "C1", "a", "テスト語B"],
  ["beta", "B2", "v", ""],
];
const ctx = { favorites: new Set<string>(), registered: new Set<string>() };

describe("収録辞書の検索", () => {
  it("完全一致 → 前方一致 → 部分一致の順", () => {
    const r = searchDictionary(rows, { ...DEFAULT_FILTER, query: "alpha" }, ctx).map((x) => x[0]);
    expect(r).toEqual(["alpha", "alphabet", "lalpha"]);
  });
  it("日本語で短い訳を検索できる", () => {
    const r = searchDictionary(rows, { ...DEFAULT_FILTER, query: "語B" }, ctx).map((x) => x[0]);
    expect(r).toEqual(["lalpha"]);
  });
  it("レベル未設定・英検・品詞で絞り込める", () => {
    expect(searchDictionary(rows, { ...DEFAULT_FILTER, cefr: "none" }, ctx).map((x) => x[0])).toEqual(["alphabet"]);
    expect(searchDictionary(rows, { ...DEFAULT_FILTER, eiken: "p1" }, ctx).map((x) => x[0])).toEqual(["beta"]);
    expect(searchDictionary(rows, { ...DEFAULT_FILTER, pos: "verb" }, ctx).map((x) => x[0])).toEqual(["alpha", "beta"]);
  });
  it("お気に入り・登録済み・未登録", () => {
    const c = { favorites: new Set(["beta"]), registered: new Set(["alpha"]) };
    expect(searchDictionary(rows, { ...DEFAULT_FILTER, status: "favorites" }, c).map((x) => x[0])).toEqual(["beta"]);
    expect(searchDictionary(rows, { ...DEFAULT_FILTER, status: "registered" }, c).map((x) => x[0])).toEqual(["alpha"]);
    expect(searchDictionary(rows, { ...DEFAULT_FILTER, status: "unregistered" }, c)).toHaveLength(3);
  });
});

describe("英検の目安", () => {
  it("CEFR から換算し、未設定なら null", () => {
    expect(eikenFromCefr("A1")).toBe("3");
    expect(eikenFromCefr("B2")).toBe("p1");
    expect(eikenFromCefr("")).toBeNull();
    expect(eikenLabel("C2")).toBe("英検1級以上");
    expect(eikenLabel(null)).toBeNull();
  });
});

describe("辞書 → 単語帳", () => {
  const rec: DictRecord = {
    w: "alpha",
    pos: [
      { p: "noun", defs: [{ en: "Test definition.", ex: "A test example." }, { en: "Second." }], jaTr: ["テスト語"] },
      { p: "verb", defs: [{ en: "To test." }] },
    ],
    ipa: { us: "/x/" },
    cefr: "A2",
    caution: ["vulgar"],
  };
  it("無い項目は空のまま・例文の日本語訳は作らない", () => {
    const e = dictRecordToEntry(rec);
    expect(e.senses).toHaveLength(2);
    expect(e.senses[0]!.meaningJa).toBe("テスト語");
    expect(e.senses[1]!.meaningJa).toBe("");
    expect(e.senses[0]!.examples[0]!.ja).toBe("");
    expect(e.senses[0]!.examples[0]!.cefr).toBeNull();
    expect(e.cefr).toBe("A2");
    expect(e.source?.type).toBe("dictionary");
    expect(e.usageNote).toContain("下品な表現");
  });
  it("リポジトリに登録できる", async () => {
    const data = new Map<string, string>();
    const storage: KeyValueStorage = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
    const repo = new LocalLearningRepository(storage);
    const entry = await repo.addEntry(dictRecordToEntry(rec));
    expect(entry.headword).toBe("alpha");
    expect(await repo.toggleDictFavorite("alpha")).toBe(true);
    expect((await repo.load()).dictFavorites).toEqual(["alpha"]);
    expect(await repo.toggleDictFavorite("alpha")).toBe(false);
  });
  it("分割ファイル名", () => {
    expect(shardOf("Apple")).toBe("a");
    expect(shardOf("'tis")).toBe("_");
  });
});
