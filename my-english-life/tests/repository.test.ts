import { describe, expect, it } from "vitest";

import { primaryMeaning } from "@/lib/schemas";
import { summarize } from "@/lib/stats";
import { LocalLearningRepository, STORAGE_KEY, type KeyValueStorage } from "@/lib/store/local-repository";
import { V1_BACKUP_KEY, V1_STORAGE_KEY } from "@/lib/store/migrate-v1";
import type { EntryInput } from "@/lib/store/types";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function makeRepo(storage = memoryStorage()) {
  const repo = new LocalLearningRepository(storage, () => new Date(2026, 10, 13, 10));
  return { repo, storage };
}

function input(headword: string, patch: Partial<EntryInput> = {}): EntryInput {
  return {
    kind: "word",
    headword,
    ipa: "",
    cefr: null,
    senses: [{ id: "s1", pos: null, meaningJa: "", definitionEn: "", examples: [], note: "" }],
    synonyms: [],
    antonyms: [],
    alternatives: [],
    related: [],
    registers: [],
    regions: [],
    usageNote: "",
    tags: [],
    note: "",
    ...patch,
  };
}

describe("word book (entries)", () => {
  it("registers a word without any Japanese meaning", async () => {
    const { repo } = makeRepo();
    const e = await repo.addEntry(input("serendipity"));
    const s = await repo.load();
    expect(s.entries[0]?.id).toBe(e.id);
    expect(primaryMeaning(e)).toBe("");
    expect(e.source.type).toBe("user");
    // 復習予定は翌日から
    expect(s.reviewStates[0]?.dueOn).toBe("2026-11-14");
    expect(summarize(s, "2026-11-13").wordCount).toBe(1);
  });

  it("keeps different senses of the same word separately", async () => {
    const { repo } = makeRepo();
    const e = await repo.addEntry(
      input("run", {
        senses: [
          { id: "a", pos: "verb", meaningJa: "走る", definitionEn: "to move fast on foot", examples: [], note: "" },
          { id: "b", pos: "verb", meaningJa: "経営する", definitionEn: "to manage", examples: [], note: "" },
        ],
      }),
    );
    expect(e.senses.map((s) => s.meaningJa)).toEqual(["走る", "経営する"]);
    expect(primaryMeaning(e)).toBe("走る");
  });

  it("stores examples with CEFR, and unknown level stays null (not guessed)", async () => {
    const { repo } = makeRepo();
    const e = await repo.addEntry(
      input("happy", {
        senses: [
          {
            id: "a",
            pos: "adjective",
            meaningJa: "幸せな",
            definitionEn: "",
            note: "",
            examples: [
              { id: "x1", en: "I'm happy.", ja: "", cefr: "A1", source: { type: "user" } },
              { id: "x2", en: "Happy birthday!", ja: "誕生日おめでとう", cefr: null, source: { type: "user" } },
            ],
          },
        ],
        cefr: null,
      }),
    );
    expect(e.cefr).toBeNull();
    expect(e.senses[0]!.examples.map((x) => x.cefr)).toEqual(["A1", null]);
  });

  it("edits and deletes (with its review records)", async () => {
    const { repo } = makeRepo();
    const e = await repo.addEntry(input("glad"));
    const edited = await repo.updateEntry(e.id, input("glad", { kind: "word", synonyms: ["happy", "pleased"] }));
    expect(edited.synonyms).toEqual(["happy", "pleased"]);
    expect(edited.createdAt).toBe(e.createdAt);
    await repo.recordReview({ attemptId: "a1", entryId: e.id, rating: "got_it", source: "manual", isRetry: false });
    await repo.deleteEntry(e.id);
    const s = await repo.load();
    expect(s.entries).toHaveLength(0);
    expect(s.reviewStates).toHaveLength(0);
    expect(s.reviewLogs).toHaveLength(0);
  });

  it("rejects an empty headword", async () => {
    const { repo } = makeRepo();
    await expect(repo.addEntry(input("   "))).rejects.toThrow();
  });

  it("keeps broken saved data aside instead of deleting it", async () => {
    const storage = memoryStorage();
    storage.data.set(STORAGE_KEY, "{broken");
    const { repo } = makeRepo(storage);
    expect((await repo.load()).entries).toHaveLength(0);
    expect([...storage.data.keys()].some((k) => k.startsWith("mel:corrupt:"))).toBe(true);
  });
});

describe("backup (export / import)", () => {
  it("exports and imports into another device without duplicates", async () => {
    const a = makeRepo();
    const e = await a.repo.addEntry(input("delighted"));
    await a.repo.recordReview({ attemptId: "r1", entryId: e.id, rating: "got_it", source: "auto", isRetry: false });
    const json = await a.repo.exportJson();

    const b = makeRepo();
    await b.repo.addEntry(input("another"));
    expect(await b.repo.importJson(json)).toEqual({ added: 1, skipped: 0 });
    expect(await b.repo.importJson(json)).toEqual({ added: 0, skipped: 1 });
    const s = await b.repo.load();
    expect(s.entries.map((x) => x.headword).sort()).toEqual(["another", "delighted"]);
    expect(s.reviewLogs.filter((l) => l.entryId === e.id)).toHaveLength(1);
    expect(s.reviewStates.find((r) => r.entryId === e.id)?.dueOn).toBe("2026-11-16");
  });

  it("refuses files that are not a backup", async () => {
    const { repo } = makeRepo();
    await expect(repo.importJson("not json")).rejects.toThrow();
    await expect(repo.importJson(JSON.stringify({ hello: 1 }))).rejects.toThrow();
  });
});

describe("migration from 1.x (AI composition app)", () => {
  const v1 = {
    version: 1,
    phrases: [
      {
        id: "p1",
        japanese: "今日は楽しかった",
        scene: "daily",
        userEnglish: "Today is fun.",
        recommended: "I had so much fun today!",
        alternatives: [{ english: "Today was a blast!", nuance: "" }],
        explanation: "過去形にします。",
        keyExpressions: [{ expression: "have fun", meaning: "楽しむ" }],
        levelVersions: [
          { level: "A1", english: "Today was fun.", japanese: "今日は楽しかった。", changes: "", note: "" },
        ],
        grammarCategories: [],
        verdict: "almost",
        isSample: false,
        createdAt: "2026-11-10T00:00:00.000Z",
      },
      {
        id: "sample1",
        japanese: "サンプル",
        recommended: "Sample sentence.",
        isSample: true,
        createdAt: "2026-11-10T00:00:00.000Z",
      },
    ],
    reviewStates: [
      {
        phraseId: "p1",
        startedOn: "2026-11-10",
        stage: 1,
        dueOn: "2026-11-13",
        successStreak: 1,
        lapses: 0,
        totalReviews: 1,
        mastered: false,
        lastReviewedOn: "2026-11-11",
      },
      {
        phraseId: "sample1",
        startedOn: "2026-11-10",
        stage: 0,
        dueOn: "2026-11-11",
        successStreak: 0,
        lapses: 0,
        totalReviews: 0,
        mastered: false,
        lastReviewedOn: null,
      },
    ],
    reviewLogs: [
      { id: "l1", phraseId: "p1", rating: "got_it", reviewedOn: "2026-11-11", createdAt: "2026-11-11T00:00:00.000Z" },
    ],
    attempts: [],
    activity: [{ date: "2026-11-11", corrections: 2, reviews: 1, saves: 1 }],
    settings: { level: "B1", weeklyGoalDays: 4, goalText: "", speechRate: 0.9, accent: "en-US", theme: "dark" },
  };

  it("backs up first, keeps the original, skips samples, and keeps the review schedule", async () => {
    const storage = memoryStorage();
    const raw = JSON.stringify(v1);
    storage.data.set(V1_STORAGE_KEY, raw);
    const { repo } = makeRepo(storage);
    const s = await repo.load();

    expect(storage.data.get(V1_STORAGE_KEY)).toBe(raw); // 元データは消さない
    expect(storage.data.get(V1_BACKUP_KEY)).toBe(raw); // バックアップを作る
    expect(await repo.legacyBackup()).toBe(raw);

    expect(s.entries.map((e) => e.id)).toEqual(["p1"]); // サンプルは移さない
    const e = s.entries[0]!;
    expect(e.headword).toBe("I had so much fun today!");
    expect(e.kind).toBe("phrase");
    expect(e.senses[0]!.meaningJa).toBe("今日は楽しかった");
    expect(e.alternatives).toEqual(["Today was a blast!"]);
    expect(e.related).toEqual(["have fun"]);
    expect(e.source.type).toBe("migrated");
    expect(e.senses[0]!.examples[0]).toMatchObject({ en: "Today was fun.", cefr: "A1" });
    expect(e.note.includes("Today is fun.")).toBe(true);

    expect(s.reviewStates).toHaveLength(1);
    expect(s.reviewStates[0]).toMatchObject({ entryId: "p1", stage: 1, dueOn: "2026-11-13" });
    expect(s.reviewLogs).toHaveLength(1);
    expect(s.settings.theme).toBe("dark");
    expect(summarize(s, "2026-11-13").dueToday).toBe(1);
    expect(summarize(s, "2026-11-13").streak).toBe(0); // 11/11 のみ → 11/12 が空いているので0
    expect(summarize(s, "2026-11-12").streak).toBe(1);
  });

  it("migrates only once and never re-imports deleted data", async () => {
    const storage = memoryStorage();
    storage.data.set(V1_STORAGE_KEY, JSON.stringify(v1));
    const { repo } = makeRepo(storage);
    await repo.load();
    await repo.deleteEntry("p1");
    expect((await repo.load()).entries).toHaveLength(0);
    await repo.clearAll();
    expect((await repo.load()).entries).toHaveLength(0);
    expect(storage.data.has(V1_STORAGE_KEY)).toBe(true);
  });

  it("survives a broken v1 file", async () => {
    const storage = memoryStorage();
    storage.data.set(V1_STORAGE_KEY, "{oops");
    const { repo } = makeRepo(storage);
    expect((await repo.load()).entries).toHaveLength(0);
    expect(storage.data.get(V1_STORAGE_KEY)).toBe("{oops");
  });
});
