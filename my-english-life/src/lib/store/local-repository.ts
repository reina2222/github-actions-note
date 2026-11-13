/**
 * この端末（ブラウザの localStorage）にデータを保存するリポジトリ。
 * ログインなしで使える。端末間の同期はない（JSON のエクスポート／インポートで移せる）。
 */
import { z } from "zod";

import { toLocalDate } from "../dates";
import { entrySchema, type Entry } from "../schemas";
import { applyReview, createInitialReviewState } from "../srs";
import { V1_BACKUP_KEY, V1_STORAGE_KEY, migrateV1 } from "./migrate-v1";
import {
  emptySnapshot,
  settingsSchema,
  snapshotSchema,
  type ActivityDay,
  type EntryInput,
  type ImportResult,
  type LearningRepository,
  type RecordReviewInput,
  type RecordReviewResult,
  type Settings,
  type Snapshot,
} from "./types";

export const STORAGE_KEY = "mel:data:v2";
export const EXPORT_APP_ID = "my-english-life";
export const EXPORT_FORMAT = 2;

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function bumpActivity(activity: ActivityDay[], date: string, field: "reviews" | "saves"): ActivityDay[] {
  const existing = activity.find((a) => a.date === date);
  if (existing) return activity.map((a) => (a.date === date ? { ...a, [field]: a[field] + 1 } : a));
  return [...activity, { date, corrections: 0, reviews: 0, saves: 0, [field]: 1 }];
}

const exportFileSchema = z.object({
  app: z.literal(EXPORT_APP_ID),
  format: z.literal(EXPORT_FORMAT),
  exportedAt: z.string(),
  data: snapshotSchema,
});

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

export class LocalLearningRepository implements LearningRepository {
  readonly kind = "local" as const;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly clock: () => Date = () => new Date(),
    /** 日付の境界に使うタイムゾーン（省略時は端末の設定） */
    private readonly timeZone?: string,
  ) {}

  today() {
    return toLocalDate(this.clock(), this.timeZone);
  }

  private nowIso() {
    return this.clock().toISOString();
  }

  /** 旧版のデータがあれば、バックアップしてから移行する（旧データは消さない） */
  private migrateFromV1IfNeeded(): Snapshot | null {
    const v1 = this.storage.getItem(V1_STORAGE_KEY);
    if (!v1) return null;
    if (!this.storage.getItem(V1_BACKUP_KEY)) this.storage.setItem(V1_BACKUP_KEY, v1);
    const { snapshot } = migrateV1(v1, this.nowIso());
    this.write(snapshot);
    return snapshot;
  }

  /** すべての項目に復習状態があるようにする（無ければ作る） */
  private withReviewStates(s: Snapshot): Snapshot {
    const have = new Set(s.reviewStates.map((r) => r.entryId));
    const missing = s.entries.filter((e) => !have.has(e.id));
    if (missing.length === 0) return s;
    const today = this.today();
    return { ...s, reviewStates: [...s.reviewStates, ...missing.map((e) => createInitialReviewState(e.id, today))] };
  }

  private read(): Snapshot {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return this.migrateFromV1IfNeeded() ?? emptySnapshot();
    try {
      const parsed = snapshotSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return this.withReviewStates(parsed.data);
    } catch {
      // fallthrough
    }
    // 壊れたデータは上書きせず、別のキーに退避してから空で始める（内容はログに出さない）
    const quarantine = `mel:corrupt:${Date.now()}`;
    this.storage.setItem(quarantine, raw);
    this.storage.removeItem(STORAGE_KEY);
    console.warn("[store] saved data was invalid; moved aside");
    return emptySnapshot();
  }

  private write(snapshot: Snapshot) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }

  private mutate<T>(fn: (s: Snapshot) => { next: Snapshot; value: T }): T {
    const { next, value } = fn(this.read());
    this.write(next);
    return value;
  }

  async load(): Promise<Snapshot> {
    return this.read();
  }

  private validate(input: EntryInput, id: string, createdAt: string): Entry {
    const parsed = entrySchema.safeParse({
      ...input,
      id,
      source: input.source ?? { type: "user" },
      createdAt,
      updatedAt: this.nowIso(),
    });
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "入力内容を確認してください。");
    return parsed.data;
  }

  async addEntry(input: EntryInput): Promise<Entry> {
    const today = this.today();
    return this.mutate((s) => {
      const entry = this.validate(input, createId(), this.nowIso());
      return {
        value: entry,
        next: {
          ...s,
          entries: [entry, ...s.entries],
          // 復習予定は登録時に作る（翌日から）
          reviewStates: [...s.reviewStates, createInitialReviewState(entry.id, today)],
          activity: bumpActivity(s.activity, today, "saves"),
        },
      };
    });
  }

  async updateEntry(id: string, input: EntryInput): Promise<Entry> {
    return this.mutate((s) => {
      const current = s.entries.find((e) => e.id === id);
      if (!current) throw new Error("この項目は見つかりませんでした。");
      const entry = this.validate({ ...input, source: input.source ?? current.source }, id, current.createdAt);
      return { value: entry, next: { ...s, entries: s.entries.map((e) => (e.id === id ? entry : e)) } };
    });
  }

  async deleteEntry(id: string): Promise<void> {
    this.mutate((s) => ({
      value: undefined,
      next: {
        ...s,
        entries: s.entries.filter((e) => e.id !== id),
        reviewStates: s.reviewStates.filter((r) => r.entryId !== id),
        reviewLogs: s.reviewLogs.filter((r) => r.entryId !== id),
      },
    }));
  }

  async recordReview(input: RecordReviewInput): Promise<RecordReviewResult> {
    const today = this.today();
    return this.mutate<RecordReviewResult>((s) => {
      const state = s.reviewStates.find((r) => r.entryId === input.entryId);
      if (!state) throw new Error("review state not found");
      // 同じ回答IDがすでにあれば何もしない（連打・再読み込み対策）
      if (s.reviewLogs.some((l) => l.id === input.attemptId)) {
        return { value: { next: state, requeueInSession: false, intervalDays: 0, duplicate: true }, next: s };
      }
      const mode = s.settings.reviewMode;
      const outcome = applyReview(state, input.rating, today, { mode, isRetry: input.isRetry });
      return {
        value: { ...outcome, duplicate: false },
        next: {
          ...s,
          reviewStates: s.reviewStates.map((r) => (r.entryId === input.entryId ? outcome.next : r)),
          reviewLogs: [
            ...s.reviewLogs,
            {
              id: input.attemptId,
              entryId: input.entryId,
              rating: input.rating,
              reviewedOn: today,
              createdAt: this.nowIso(),
              source: input.source,
              isRetry: input.isRetry,
              mode,
            },
          ],
          activity: bumpActivity(s.activity, today, "reviews"),
        },
      };
    });
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    return this.mutate((s) => {
      const settings = settingsSchema.parse({ ...s.settings, ...patch });
      return { value: settings, next: { ...s, settings } };
    });
  }

  async toggleDictFavorite(word: string): Promise<boolean> {
    return this.mutate((s) => {
      const on = !s.dictFavorites.includes(word);
      const dictFavorites = on ? [word, ...s.dictFavorites] : s.dictFavorites.filter((w) => w !== word);
      return { value: on, next: { ...s, dictFavorites } };
    });
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(
      { app: EXPORT_APP_ID, format: EXPORT_FORMAT, exportedAt: this.nowIso(), data: this.read() },
      null,
      2,
    );
  }

  /**
   * バックアップ（JSON）を取り込む。今のデータは消さずに「追加」する。
   * すでに同じ ID の項目があればそれは取り込まない（二重登録しない）。設定は今のものを使う。
   */
  async importJson(json: string): Promise<ImportResult> {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      throw new ImportError("ファイルを読み込めませんでした（JSON 形式ではありません）。");
    }
    const parsed = exportFileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ImportError("My English Life のバックアップファイルではないか、内容が壊れています。");
    }
    const incoming = parsed.data.data;
    return this.mutate((s) => {
      const existing = new Set(s.entries.map((e) => e.id));
      const added = incoming.entries.filter((e) => !existing.has(e.id));
      const addedIds = new Set(added.map((e) => e.id));
      const logIds = new Set(s.reviewLogs.map((l) => l.id));
      const activity = [...s.activity];
      for (const a of incoming.activity) {
        const i = activity.findIndex((x) => x.date === a.date);
        if (i < 0) activity.push(a);
        else {
          const cur = activity[i]!;
          activity[i] = {
            date: a.date,
            corrections: Math.max(cur.corrections, a.corrections),
            reviews: Math.max(cur.reviews, a.reviews),
            saves: Math.max(cur.saves, a.saves),
          };
        }
      }
      return {
        value: { added: added.length, skipped: incoming.entries.length - added.length },
        next: this.withReviewStates({
          ...s,
          entries: [...added, ...s.entries],
          reviewStates: [...s.reviewStates, ...incoming.reviewStates.filter((r) => addedIds.has(r.entryId))],
          reviewLogs: [
            ...s.reviewLogs,
            ...incoming.reviewLogs.filter((l) => addedIds.has(l.entryId) && !logIds.has(l.id)),
          ],
          activity,
          dictFavorites: [...new Set([...s.dictFavorites, ...incoming.dictFavorites])],
        }),
      };
    });
  }

  async legacyBackup(): Promise<string | null> {
    return this.storage.getItem(V1_BACKUP_KEY) ?? this.storage.getItem(V1_STORAGE_KEY);
  }

  /** この端末の 2.0 のデータを削除（旧版のバックアップは残す） */
  async clearAll(): Promise<void> {
    this.storage.removeItem(STORAGE_KEY);
    // 旧データから再び移行されないよう、空のデータを書いておく
    this.write({ ...emptySnapshot(), migratedFromV1At: this.nowIso() });
  }
}
