import type { DictIndex, DictMeta, DictRecord } from "./types";
import { shardOf } from "./shard";

/*
 * 収録辞書の読み込み
 *   - 起動時には何も読まない。辞書の画面を開いたときに初めて検索用の一覧（index.json）を読む。
 *   - 詳細は「先頭の文字」ごとのファイル（entries/a.json など）を、必要になったときだけ読む。
 *   - 一度読んだものはメモリに保持（Service Worker がオフライン用にも保存する）。
 */
const BASE = "/dict";

export class DictionaryNotInstalledError extends Error {
  constructor() {
    super("収録辞書がまだ入っていません");
    this.name = "DictionaryNotInstalledError";
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`);
  if (res.status === 404) throw new DictionaryNotInstalledError();
  if (!res.ok) throw new Error(`辞書データを読み込めませんでした（${res.status}）`);
  return (await res.json()) as T;
}

let indexPromise: Promise<DictIndex> | null = null;
let metaPromise: Promise<DictMeta> | null = null;
const shardPromises = new Map<string, Promise<Record<string, DictRecord>>>();

/** 失敗した読み込みは覚えておかない（オンラインに戻ったら再試行できるように） */
function remember<T>(p: Promise<T>, forget: () => void): Promise<T> {
  p.catch(forget);
  return p;
}

export function loadDictIndex(): Promise<DictIndex> {
  indexPromise ??= remember(getJson<DictIndex>("index.json"), () => (indexPromise = null));
  return indexPromise;
}

export function loadDictMeta(): Promise<DictMeta> {
  metaPromise ??= remember(getJson<DictMeta>("meta.json"), () => (metaPromise = null));
  return metaPromise;
}

export async function loadDictRecord(word: string): Promise<DictRecord | null> {
  const s = shardOf(word);
  let p = shardPromises.get(s);
  if (!p) {
    p = remember(getJson<Record<string, DictRecord>>(`entries/${s}.json`), () => shardPromises.delete(s));
    shardPromises.set(s, p);
  }
  const shard = await p;
  return Object.prototype.hasOwnProperty.call(shard, word) ? (shard[word] ?? null) : null;
}
