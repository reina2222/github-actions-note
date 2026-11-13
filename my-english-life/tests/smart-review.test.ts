/**
 * スマート復習の結合テスト（保存先 + 今日の復習プラン + お知らせ判定）
 * 番号は仕様書のテスト項目に対応。
 */
import { describe, expect, it } from "vitest";

import { dismissNotice, isNoticeDismissed, planTodaysReview, shouldShowLaunchNotice } from "@/lib/review-plan";
import { LocalLearningRepository, type KeyValueStorage } from "@/lib/store/local-repository";
import { V1_STORAGE_KEY } from "@/lib/store/migrate-v1";
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

/** 東京時間の日付・時刻で時計を進められるリポジトリ */
function setup(start = "2026-11-12T10:00:00+09:00") {
  let now = new Date(start);
  const storage = memoryStorage();
  const repo = new LocalLearningRepository(storage, () => now, "Asia/Tokyo");
  return {
    repo,
    storage,
    goto: (iso: string) => (now = new Date(iso)),
    plan: async () => planTodaysReview(await repo.load(), repo.today()),
  };
}

const phrase = (headword: string): EntryInput => ({
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
});

let n = 0;
const attempt = () => `attempt-${++n}`;

describe("smart review", () => {
  it("[1] saving a phrase creates a review schedule (due the next day)", async () => {
    const { repo } = setup();
    const p = await repo.addEntry(phrase("a"));
    const s = await repo.load();
    const st = s.reviewStates.find((r) => r.entryId === p.id);
    expect(st?.startedOn).toBe("2026-11-12");
    expect(st?.dueOn).toBe("2026-11-13");
    expect(st?.stage).toBe(0);
  });

  it("[2] not offered before the due date", async () => {
    const { repo, plan } = setup();
    await repo.addEntry(phrase("a"));
    expect((await plan()).queue).toHaveLength(0);
  });

  it("[3] shown on home when due", async () => {
    const { repo, plan, goto } = setup();
    await repo.addEntry(phrase("a"));
    goto("2026-11-13T07:00:00+09:00");
    const p = await plan();
    expect(p.queue).toHaveLength(1);
    const settings = (await repo.load()).settings;
    expect(shouldShowLaunchNotice({ settings, queueLength: p.queue.length, dismissed: false })).toBe(true);
    // お知らせOFFなら出さない
    await repo.updateSettings({ launchNotice: false });
    const s2 = (await repo.load()).settings;
    expect(shouldShowLaunchNotice({ settings: s2, queueLength: p.queue.length, dismissed: false })).toBe(false);
  });

  it("[4] no automatic review while OFF / [5] history kept when turned back ON", async () => {
    const { repo, plan, goto } = setup();
    const p = await repo.addEntry(phrase("a"));
    const q = await repo.addEntry(phrase("b"));
    goto("2026-11-13T09:00:00+09:00");
    await repo.recordReview({ attemptId: attempt(), entryId: p.id, rating: "got_it", source: "auto", isRetry: false });

    await repo.updateSettings({ autoReview: false });
    const off = await plan();
    expect(off.enabled).toBe(false);
    expect(off.queue).toHaveLength(0);
    const offSettings = (await repo.load()).settings;
    expect(shouldShowLaunchNotice({ settings: offSettings, queueLength: 5, dismissed: false })).toBe(false);

    // OFF中でもノートからの手動復習はできる
    await repo.recordReview({
      attemptId: attempt(),
      entryId: q.id,
      rating: "close",
      source: "manual",
      isRetry: false,
    });

    await repo.updateSettings({ autoReview: true });
    const s = await repo.load();
    expect(s.entries).toHaveLength(2);
    expect(s.reviewLogs).toHaveLength(2);
    expect(s.reviewStates.find((r) => r.entryId === p.id)?.dueOn).toBe("2026-11-16");
  });

  it("[6] 'later' suppresses the notice for the rest of the launch session (same day only)", () => {
    const session = memoryStorage();
    expect(isNoticeDismissed(session, "2026-11-13")).toBe(false);
    dismissNotice(session, "2026-11-13");
    expect(isNoticeDismissed(session, "2026-11-13")).toBe(true);
    expect(isNoticeDismissed(session, "2026-11-14")).toBe(false); // 日付が変われば再表示
    expect(isNoticeDismissed(memoryStorage(), "2026-11-13")).toBe(false); // 次回起動（新しいセッション）
    expect(isNoticeDismissed(null, "2026-11-13")).toBe(false);
  });

  it("[7] rating changes the next date (adaptive and fixed)", async () => {
    const { repo, goto } = setup();
    const a = await repo.addEntry(phrase("a"));
    const b = await repo.addEntry(phrase("b"));
    goto("2026-11-13T09:00:00+09:00");
    const r1 = await repo.recordReview({
      attemptId: attempt(),
      entryId: a.id,
      rating: "got_it",
      source: "auto",
      isRetry: false,
    });
    expect(r1.next.dueOn).toBe("2026-11-16");
    const r2 = await repo.recordReview({
      attemptId: attempt(),
      entryId: b.id,
      rating: "again",
      source: "auto",
      isRetry: false,
    });
    expect(r2.requeueInSession).toBe(true);
    expect(r2.next.dueOn).toBe("2026-11-14");

    await repo.updateSettings({ reviewMode: "fixed" });
    goto("2026-11-16T09:00:00+09:00");
    const r3 = await repo.recordReview({
      attemptId: attempt(),
      entryId: a.id,
      rating: "close",
      source: "auto",
      isRetry: false,
    });
    expect(r3.next.dueOn).toBe("2026-11-19"); // 学習日 11/12 + 7日
    expect((await repo.load()).reviewLogs.at(-1)?.mode).toBe("fixed");
  });

  it("[8] date change at local midnight, overdue items and time zones", async () => {
    const { repo, plan, goto } = setup("2026-11-12T23:50:00+09:00");
    await repo.addEntry(phrase("a")); // 東京で 11/12 に保存
    goto("2026-11-13T00:05:00+09:00"); // 15分後、日付が変わった
    expect((await plan()).queue).toHaveLength(1);
    goto("2026-12-25T12:00:00+09:00"); // 1か月以上あいても
    const p = await plan();
    expect(p.queue).toHaveLength(1); // 重複せず1件
    expect(p.dueTotal).toBe(1);

    // 同じ瞬間でも、ロサンゼルスのユーザーにとってはまだ前日
    const storage = memoryStorage();
    const la = new LocalLearningRepository(storage, () => new Date("2026-11-13T00:05:00+09:00"), "America/Los_Angeles");
    expect(la.today()).toBe("2026-11-12");
  });

  it("[9] double taps / reloads do not double-register a review", async () => {
    const { repo, goto } = setup();
    const p = await repo.addEntry(phrase("a"));
    goto("2026-11-13T09:00:00+09:00");
    const id = attempt();
    const input = { attemptId: id, entryId: p.id, rating: "got_it" as const, source: "auto" as const, isRetry: false };
    const [first, second] = await Promise.all([repo.recordReview(input), repo.recordReview(input)]);
    const again = await repo.recordReview(input); // 再読み込み後の再送
    expect([first.duplicate, second.duplicate].filter(Boolean)).toHaveLength(1);
    expect(again.duplicate).toBe(true);
    const s = await repo.load();
    expect(s.reviewLogs).toHaveLength(1);
    expect(s.reviewStates[0]?.successStreak).toBe(1);
    expect(s.reviewStates[0]?.dueOn).toBe("2026-11-16");
  });

  it("daily limit caps today's questions and carries the rest over (never deleted)", async () => {
    const { repo, plan, goto } = setup();
    const ids: string[] = [];
    for (let i = 0; i < 8; i++) ids.push((await repo.addEntry(phrase(`p${i}`))).id);
    await repo.updateSettings({ dailyLimit: 5 });
    goto("2026-11-13T09:00:00+09:00");
    let p = await plan();
    expect(p.queue).toHaveLength(5);
    expect(p.carriedOver).toBe(3);
    for (const id of p.queue) {
      await repo.recordReview({ attemptId: attempt(), entryId: id, rating: "got_it", source: "auto", isRetry: false });
    }
    p = await plan();
    expect(p.queue).toHaveLength(0);
    expect(p.carriedOver).toBe(3);
    goto("2026-11-14T09:00:00+09:00");
    p = await plan();
    expect(p.queue).toHaveLength(3);
    expect((await repo.load()).entries).toHaveLength(8);
    await repo.updateSettings({ dailyLimit: null });
    expect((await plan()).queue).toHaveLength(3);
  });

  it("retries in the session do not use up the daily limit", async () => {
    const { repo, plan, goto } = setup();
    const a = await repo.addEntry(phrase("a"));
    await repo.addEntry(phrase("b"));
    await repo.updateSettings({ dailyLimit: 5 });
    goto("2026-11-13T09:00:00+09:00");
    await repo.recordReview({ attemptId: attempt(), entryId: a.id, rating: "again", source: "auto", isRetry: false });
    await repo.recordReview({ attemptId: attempt(), entryId: a.id, rating: "got_it", source: "auto", isRetry: true });
    expect((await plan()).doneToday).toBe(1);
  });

  it("migrates data saved by the previous version without losing phrases or history", async () => {
    const { repo, storage } = setup();
    storage.data.set(
      V1_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        phrases: [
          {
            id: "old1",
            japanese: "古いフレーズ",
            scene: "daily",
            userEnglish: "x",
            recommended: "y",
            alternatives: [],
            explanation: "",
            keyExpressions: [],
            grammarCategories: [],
            verdict: null,
            isSample: false,
            createdAt: "2026-11-01T00:00:00.000Z",
          },
        ],
        reviewStates: [
          {
            phraseId: "old1",
            dueOn: "2026-11-10",
            intervalStep: 2,
            successStreak: 2,
            lapses: 0,
            totalReviews: 2,
            mastered: false,
            lastReviewedOn: "2026-11-03",
          },
        ],
        reviewLogs: [
          {
            id: "l1",
            phraseId: "old1",
            rating: "got_it",
            reviewedOn: "2026-11-03",
            createdAt: "2026-11-03T00:00:00.000Z",
          },
        ],
        attempts: [],
        activity: [],
        settings: { level: "B1", weeklyGoalDays: 5, goalText: "", speechRate: 0.9, accent: "en-US", theme: "system" },
      }),
    );
    const s = await repo.load();
    expect(s.entries).toHaveLength(1);
    expect(s.reviewStates[0]?.stage).toBe(2);
    expect(s.reviewStates[0]?.startedOn).toBe("2026-11-03");
    expect(s.reviewLogs[0]?.source).toBe("auto");
    expect(s.settings.level).toBe("B1");
    expect(s.settings.autoReview).toBe(true);
    expect(s.settings.dailyLimit).toBe(10);
    expect(s.settings.reviewMode).toBe("adaptive");
    // 期限超過のまま残っていて、今日の復習に出る
    expect(planTodaysReview(s, "2026-11-12").queue).toEqual(["old1"]);
  });
});
