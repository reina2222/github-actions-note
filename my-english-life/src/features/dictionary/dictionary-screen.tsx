"use client";

import Link from "next/link";
import { BookOpenText, Check, ChevronRight, CloudOff, Search, SearchX, Star } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { Button, Chip, EmptyState, LoadingBlock, Notice, PageHeader, SegmentedControl, cn } from "@/components/ui";
import { DictionaryNotInstalledError, loadDictIndex } from "@/lib/dictionary/client";
import { DEFAULT_FILTER, searchDictionary, type DictFilter } from "@/lib/dictionary/search";
import { EIKEN_GRADES, EIKEN_LABELS, POS_FROM_CODE, eikenLabel, type DictIndex } from "@/lib/dictionary/types";
import { routes } from "@/lib/routes";
import { CEFR_LEVELS, PARTS_OF_SPEECH, POS_LABELS, type CefrLevel } from "@/lib/schemas";
import { useLearning } from "@/lib/store/learning-provider";

import { CefrBadge } from "../words/cefr-picker";

const PAGE = 50;
// 詳細から戻ったときに検索条件を残しておく（画面を閉じるまで）
let lastFilter: DictFilter = DEFAULT_FILTER;

type LoadState = { status: "loading" } | { status: "ready"; index: DictIndex } | { status: "missing" } | { status: "error" };

const selectClass =
  "block min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring";

export function DictionaryScreen() {
  const { snapshot } = useLearning();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [filter, setFilterState] = useState<DictFilter>(lastFilter);
  const [limit, setLimit] = useState(PAGE);
  const query = useDeferredValue(filter.query);

  const setFilter = (patch: Partial<DictFilter>) => {
    setFilterState((f) => (lastFilter = { ...f, ...patch }));
    setLimit(PAGE);
  };

  useEffect(() => {
    let alive = true;
    loadDictIndex()
      .then((index) => alive && setLoad({ status: "ready", index }))
      .catch((e: unknown) => alive && setLoad({ status: e instanceof DictionaryNotInstalledError ? "missing" : "error" }));
    return () => {
      alive = false;
    };
  }, []);

  const favorites = useMemo(() => new Set(snapshot?.dictFavorites ?? []), [snapshot]);
  const registered = useMemo(
    () => new Set((snapshot?.entries ?? []).map((e) => e.headword.trim().toLowerCase())),
    [snapshot],
  );
  const results = useMemo(
    () =>
      load.status === "ready"
        ? searchDictionary(load.index.rows, { ...filter, query }, { favorites, registered })
        : [],
    [load, filter, query, favorites, registered],
  );

  return (
    <div>
      <PageHeader
        title="辞書から探す"
        back={routes.words}
        right={load.status === "ready" && <span className="text-sm text-ink-muted">{load.index.rows.length.toLocaleString()}語</span>}
      />

      {load.status === "loading" && <LoadingBlock label="辞書を読み込み中…" />}
      {load.status === "missing" && (
        <EmptyState
          icon={BookOpenText}
          title="収録辞書はまだ入っていません"
          description="辞書データを作成して公開すると、ここで単語を検索できるようになります。単語帳への登録は今まで通りできます。"
        />
      )}
      {load.status === "error" && (
        <Notice tone="warning" title="辞書を読み込めませんでした">
          インターネットにつながっているか確認して、もう一度開いてください（一度開いた辞書はオフラインでも使えます）。
        </Notice>
      )}

      {load.status === "ready" && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <input
              type="search"
              value={filter.query}
              onChange={(e) => setFilter({ query: e.target.value })}
              placeholder="英語（前方・部分一致）・日本語で検索"
              aria-label="辞書を検索"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="block min-h-12 w-full rounded-2xl border border-line bg-surface pr-4 pl-12 text-base placeholder:text-ink-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-ink-muted">CEFR</span>
              <select className={selectClass} value={filter.cefr} onChange={(e) => setFilter({ cefr: e.target.value as DictFilter["cefr"] })}>
                <option value="all">すべて</option>
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
                <option value="none">レベル未設定</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-ink-muted">英検（目安）</span>
              <select className={selectClass} value={filter.eiken} onChange={(e) => setFilter({ eiken: e.target.value as DictFilter["eiken"] })}>
                <option value="all">すべて</option>
                {EIKEN_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {EIKEN_LABELS[g].replace("英検", "")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-ink-muted">品詞</span>
              <select className={selectClass} value={filter.pos} onChange={(e) => setFilter({ pos: e.target.value as DictFilter["pos"] })}>
                <option value="all">すべて</option>
                {PARTS_OF_SPEECH.map((p) => (
                  <option key={p} value={p}>
                    {POS_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <SegmentedControl
            label="表示する語"
            value={filter.status}
            onChange={(status) => setFilter({ status })}
            options={[
              { value: "all", label: "すべて" },
              { value: "favorites", label: "★のみ" },
              { value: "registered", label: "登録済み" },
              { value: "unregistered", label: "未登録" },
            ]}
          />

          <p className="text-xs text-ink-subtle" aria-live="polite">
            {results.length.toLocaleString()}件{filter.eiken !== "all" && "（英検はCEFRから換算した学習上の目安です）"}
          </p>

          {results.length === 0 ? (
            <EmptyState icon={SearchX} title="見つかりませんでした" description="つづりや条件を変えてみてください。" />
          ) : (
            <>
              <ul className="space-y-2">
                {results.slice(0, limit).map(([w, cefr, posCodes, ja]) => {
                  const isReg = registered.has(w.toLowerCase());
                  const eiken = eikenLabel(cefr);
                  return (
                    <li key={w}>
                      <Link
                        href={routes.dictionaryDetail(w)}
                        className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 shadow-card hover:border-primary"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5">
                            <span className="english truncate text-lg font-bold">{w}</span>
                            {favorites.has(w) && <Star size={16} className="shrink-0 fill-current text-warning" aria-label="お気に入り" />}
                          </p>
                          <p className={cn("truncate text-sm", ja ? "text-ink-muted" : "text-ink-subtle")}>{ja || "日本語訳は未収録"}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <CefrBadge level={(cefr || null) as CefrLevel | null} />
                            {eiken && <Chip tone="muted">{eiken}の目安</Chip>}
                            {[...posCodes].slice(0, 3).map((c) => {
                              const p = POS_FROM_CODE[c];
                              return p ? (
                                <Chip key={c} tone="muted">
                                  {POS_LABELS[p]}
                                </Chip>
                              ) : null;
                            })}
                            {isReg && (
                              <Chip tone="success">
                                <Check size={12} aria-hidden />
                                登録済み
                              </Chip>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={20} className="shrink-0 text-ink-subtle" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {results.length > limit && (
                <Button variant="secondary" full onClick={() => setLimit((n) => n + PAGE)}>
                  もっと見る（残り{(results.length - limit).toLocaleString()}件）
                </Button>
              )}
            </>
          )}
          <p className="flex items-center gap-1.5 pt-2 text-xs text-ink-subtle">
            <CloudOff size={14} aria-hidden />
            一度開いた辞書データは、オフラインでも使えます。
          </p>
        </div>
      )}
    </div>
  );
}
