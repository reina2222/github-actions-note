import { describe, expect, it } from "vitest";

import { addDays, diffDays, toLocalDate, weekDays } from "@/lib/dates";
import {
  MASTERY_STREAK,
  applyReview,
  createInitialReviewState,
  dueQueue,
  fixedScheduleDate,
  type ReviewState,
} from "@/lib/srs";

const TODAY = "2026-11-12";
const adaptive = { mode: "adaptive" as const };
const fixed = { mode: "fixed" as const };

describe("dates", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-11-12", "2026-12-12")).toBe(30);
  });

  it("returns Monday-start week", () => {
    const week = weekDays("2026-11-12"); // Thursday
    expect(week[0]).toBe("2026-11-09");
    expect(week[6]).toBe("2026-11-15");
  });

  it("[テスト8] judges 'today' in the user's time zone", () => {
    const instant = new Date("2026-11-12T16:30:00Z"); // 東京は 11/13 01:30、ロサンゼルスは 11/12 08:30
    expect(toLocalDate(instant, "Asia/Tokyo")).toBe("2026-11-13");
    expect(toLocalDate(instant, "America/Los_Angeles")).toBe("2026-11-12");
  });
});

describe("[テスト1] initial schedule", () => {
  it("first review is the day after learning", () => {
    const s = createInitialReviewState("p1", TODAY);
    expect(s.startedOn).toBe(TODAY);
    expect(s.stage).toBe(0);
    expect(s.dueOn).toBe("2026-11-13");
  });

  it("fixed schedule is 1, 3, 7, 14, 30, 60 days from the learning day, then every 60 days", () => {
    const offsets = [0, 1, 2, 3, 4, 5, 6].map((st) => diffDays(TODAY, fixedScheduleDate(TODAY, st)));
    expect(offsets).toEqual([1, 3, 7, 14, 30, 60, 120]);
  });
});

describe("[テスト7] adaptive mode", () => {
  const base = (): ReviewState => ({ ...createInitialReviewState("p1", "2026-11-11"), dueOn: TODAY });

  it("again: requeue in session, due tomorrow, stage back to 0, streak reset", () => {
    const s = { ...base(), stage: 3, successStreak: 2 };
    const out = applyReview(s, "again", TODAY, adaptive);
    expect(out.requeueInSession).toBe(true);
    expect(out.next.dueOn).toBe("2026-11-13");
    expect(out.next.stage).toBe(0);
    expect(out.next.successStreak).toBe(0);
    expect(out.next.lapses).toBe(1);
    expect(out.next.lastReviewedOn).toBe(TODAY);
  });

  it("close: due tomorrow, keeps stage, resets streak", () => {
    const out = applyReview({ ...base(), stage: 2, successStreak: 2 }, "close", TODAY, adaptive);
    expect(out.requeueInSession).toBe(false);
    expect(out.next.dueOn).toBe("2026-11-13");
    expect(out.next.stage).toBe(2);
    expect(out.next.successStreak).toBe(0);
  });

  it("got_it: intervals grow 3 → 7 → 14 → 30 → 60 → 60, mastery after 4 in a row", () => {
    let state = base();
    let day = TODAY;
    const intervals: number[] = [];
    for (let i = 0; i < 6; i++) {
      const out = applyReview(state, "got_it", day, adaptive);
      intervals.push(out.intervalDays);
      state = out.next;
      day = out.next.dueOn;
      expect(state.mastered).toBe(i + 1 >= MASTERY_STREAK);
    }
    expect(intervals).toEqual([3, 7, 14, 30, 60, 60]);
  });

  it("losing mastery on again / close", () => {
    const m = { ...base(), successStreak: 4, stage: 4, mastered: true };
    expect(applyReview(m, "close", TODAY, adaptive).next.mastered).toBe(false);
    expect(applyReview(m, "again", TODAY, adaptive).next.mastered).toBe(false);
  });

  it("retry in the same session does not add to the streak or change the schedule", () => {
    const afterAgain = applyReview({ ...base(), successStreak: 2 }, "again", TODAY, adaptive).next;
    const retry = applyReview(afterAgain, "got_it", TODAY, { mode: "adaptive", isRetry: true });
    expect(retry.next.successStreak).toBe(0);
    expect(retry.next.dueOn).toBe("2026-11-13");
    expect(retry.next.stage).toBe(0);
    expect(retry.requeueInSession).toBe(false);
    expect(applyReview(afterAgain, "again", TODAY, { mode: "adaptive", isRetry: true }).requeueInSession).toBe(true);
  });
});

describe("[テスト7][テスト8] fixed mode", () => {
  it("follows cumulative dates from the learning day regardless of rating", () => {
    let s = createInitialReviewState("p1", TODAY); // due 11/13
    s = applyReview(s, "got_it", "2026-11-13", fixed).next;
    expect(s.dueOn).toBe(fixedScheduleDate(TODAY, 1)); // 11/15
    s = applyReview(s, "close", "2026-11-15", fixed).next;
    expect(s.dueOn).toBe(fixedScheduleDate(TODAY, 2)); // 11/19
    expect(s.successStreak).toBe(0);
  });

  it("when reviewed very late, skips past dates instead of piling them up", () => {
    const s = createInitialReviewState("p1", TODAY); // due 11/13 (stage 0)
    // 20日後（12/2）にやっと復習 → 3日目・7日目・14日目の予定は過ぎているので、次は30日目（12/12）
    const out = applyReview(s, "got_it", "2026-12-02", fixed);
    expect(out.next.dueOn).toBe("2026-12-12");
    expect(out.next.stage).toBe(4);
    expect(out.next.dueOn > "2026-12-02").toBe(true);
  });

  it("again still requeues in the session", () => {
    expect(applyReview(createInitialReviewState("p1", TODAY), "again", "2026-11-13", fixed).requeueInSession).toBe(
      true,
    );
  });
});

describe("[テスト2][テスト8] dueQueue", () => {
  it("not due before the due date; overdue items appear once, oldest first", () => {
    const states = [
      { ...createInitialReviewState("b", TODAY) }, // due 11/13
      { ...createInitialReviewState("a", "2026-10-01") }, // due 10/2（大幅に期限超過）
      { ...createInitialReviewState("c", "2026-11-20") },
    ];
    expect(dueQueue(states, TODAY)).toEqual(["a"]);
    expect(dueQueue(states, "2026-11-13")).toEqual(["a", "b"]);
    // 何日経っても期限超過分は1件のまま
    expect(dueQueue(states, "2026-12-31").filter((id) => id === "a")).toHaveLength(1);
  });
});
