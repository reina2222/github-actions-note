"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { LocalLearningRepository, STORAGE_KEY, type KeyValueStorage } from "./local-repository";
import type { LearningRepository, Snapshot } from "./types";

type LearningContextValue = {
  repo: LearningRepository | null;
  snapshot: Snapshot | null;
  status: "loading" | "ready" | "error";
  /** 変更系の操作を実行し、終わったらスナップショットを読み直す */
  run: <T>(fn: (repo: LearningRepository) => Promise<T>) => Promise<T>;
  reload: () => Promise<void>;
};

const LearningContext = createContext<LearningContextValue | null>(null);

function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function createRepository(): LearningRepository {
  // Phase 3: Supabase の設定とログインがあれば SupabaseLearningRepository を返す
  try {
    const ls = window.localStorage;
    ls.getItem(STORAGE_KEY); // 使えるか確認（プライベートモード等で例外になることがある）
    return new LocalLearningRepository(ls);
  } catch {
    // 保存できない環境では、ページを閉じるまでのメモリ保存で動かす
    return new LocalLearningRepository(memoryStorage());
  }
}

export function LearningProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<LearningRepository | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<LearningContextValue["status"]>("loading");

  const reloadFrom = useCallback(async (r: LearningRepository | null) => {
    if (!r) {
      setStatus("error");
      return;
    }
    try {
      setSnapshot(await r.load());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const r = createRepository();
    setRepo(r);
    void reloadFrom(r);
  }, [reloadFrom]);

  const run = useCallback(
    async <T,>(fn: (r: LearningRepository) => Promise<T>) => {
      if (!repo) throw new Error("保存先が利用できません");
      const value = await fn(repo);
      await reloadFrom(repo);
      return value;
    },
    [repo, reloadFrom],
  );

  const value = useMemo<LearningContextValue>(
    () => ({ repo, snapshot, status, run, reload: () => reloadFrom(repo) }),
    [repo, snapshot, status, run, reloadFrom],
  );

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useLearning(): LearningContextValue {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error("useLearning must be used inside <LearningProvider>");
  return ctx;
}
