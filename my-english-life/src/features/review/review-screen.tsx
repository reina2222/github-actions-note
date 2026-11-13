"use client";

import { CircleCheck, Eye, Lightbulb, NotebookPen, PartyPopper, PencilLine, RotateCcw, Settings2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EnglishAnswerInput } from "@/components/english-answer-input";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  LinkButton,
  LoadingBlock,
  Notice,
  PageHeader,
  SpeakButton,
  StoreError,
  cn,
} from "@/components/ui";
import { toLocalDate } from "@/lib/dates";
import { ENTRY_KIND_LABELS, primaryMeaning, type InputMethod } from "@/lib/schemas";
import { useAppTts } from "@/lib/speech/use-app-tts";
import { planTodaysReview } from "@/lib/review-plan";
import {
  MASTERY_STREAK,
  REVIEW_RATING_LABELS,
  applyReview,
  type ReviewMode,
  type ReviewRating,
  type ReviewState,
} from "@/lib/srs";
import { createId } from "@/lib/store/local-repository";
import { useLearning } from "@/lib/store/learning-provider";
import { routes } from "@/lib/routes";

function hintOf(english: string) {
  const words = english.split(/\s+/);
  return words.map((w, i) => (i < 2 ? w : w.replace(/[A-Za-z]/g, "_"))).join(" ");
}

function ratingSub(state: ReviewState, rating: ReviewRating, mode: ReviewMode, isRetry: boolean, today: string) {
  if (isRetry) return rating === "again" ? "最後にもう一回" : "練習として記録";
  const { intervalDays, requeueInSession } = applyReview(state, rating, today, { mode });
  const when = intervalDays <= 1 ? "明日" : `${intervalDays}日後`;
  return requeueInSession ? `最後にもう一回・${when}も` : when;
}

/**
 * 復習画面
 * - entryId なし: 今日の復習（自動出題。OFF・1日の上限を反映）
 * - entryId あり: 単語帳からの手動復習（設定に関係なく常に利用可能）
 */
export function ReviewScreen({ entryId: manualId }: { entryId?: string } = {}) {
  const manual = Boolean(manualId);
  const { snapshot, status, run } = useLearning();
  const [queue, setQueue] = useState<string[] | null>(null);
  const [carriedOver, setCarriedOver] = useState(0);
  const [hadOverdue, setHadOverdue] = useState(false);
  const [retried, setRetried] = useState<ReadonlySet<string>>(new Set());
  const [attemptId, setAttemptId] = useState(() => createId());
  const submittingRef = useRef(false);
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [answer, setAnswer] = useState("");
  const [method, setMethod] = useState<InputMethod>("text");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tally, setTally] = useState<Record<ReviewRating, number>>({ again: 0, close: 0, got_it: 0 });
  const tts = useAppTts();

  const today = toLocalDate();

  // セッション開始時点の出題対象で固定する（途中で日付が変わっても崩れない）
  useEffect(() => {
    if (!snapshot || queue !== null) return;
    if (manualId) {
      setQueue([manualId]);
      return;
    }
    const plan = planTodaysReview(snapshot, today);
    setQueue(plan.queue);
    setCarriedOver(plan.carriedOver);
    setHadOverdue(
      plan.queue.some((id) => (snapshot.reviewStates.find((r) => r.entryId === id)?.dueOn ?? today) < today),
    );
  }, [snapshot, queue, manualId, today]);

  const entryId = queue?.[position];
  const title = manual ? "この単語を復習" : "今日の復習";
  const backHref = manualId ? routes.wordDetail(manualId) : "/";
  const entry = useMemo(() => snapshot?.entries.find((p) => p.id === entryId), [snapshot, entryId]);
  const state = snapshot?.reviewStates.find((r) => r.entryId === entryId);

  if (status === "error")
    return (
      <div className="pt-6">
        <StoreError />
      </div>
    );
  if (!snapshot || queue === null) {
    return (
      <div>
        <PageHeader title={title} back={backHref} />
        <LoadingBlock />
      </div>
    );
  }

  const total = queue.length;
  const finished = position >= total;

  if (total === 0) {
    const off = !manual && !snapshot.settings.autoReview;
    const limitReached = !manual && snapshot.settings.autoReview && carriedOver > 0;
    return (
      <div>
        <PageHeader title={title} back={backHref} />
        {off ? (
          <EmptyState
            icon={Settings2}
            title="自動復習はOFFになっています"
            description="保存したフレーズと学習履歴はそのまま残っています。単語帳からいつでも1つずつ復習できます。マイページでONに戻せます。"
            action={
              <div className="grid gap-2">
                <LinkButton href={routes.words} full size="md" icon={NotebookPen}>
                  単語帳から復習する
                </LinkButton>
                <LinkButton href="/mypage" full size="md" variant="secondary">
                  復習設定を開く
                </LinkButton>
              </div>
            }
          />
        ) : limitReached ? (
          <EmptyState
            icon={CircleCheck}
            title="今日の分はここまでです"
            description={`1日の上限まで復習しました。残りの${carriedOver}件は明日以降に出題されます（消えることはありません）。`}
            action={
              <LinkButton href="/" full size="md" variant="secondary">
                ホームへ
              </LinkButton>
            }
          />
        ) : (
          <EmptyState
            icon={CircleCheck}
            title={snapshot.entries.length === 0 ? "まだ復習するカードがありません" : "今日の復習はありません"}
            description={
              snapshot.entries.length === 0
                ? "単語やフレーズを登録すると、翌日から復習に出てきます。"
                : "新しい単語やフレーズを登録してみましょう。"
            }
            action={
              <LinkButton href={routes.newWord} full size="md" icon={PencilLine}>
                単語・フレーズを登録
              </LinkButton>
            }
          />
        )}
      </div>
    );
  }

  if (finished) {
    const done = tally.again + tally.close + tally.got_it;
    return (
      <div>
        <PageHeader title={title} back={backHref} />
        <Card className="text-center">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
            <PartyPopper size={32} aria-hidden />
          </div>
          <p className="text-xl font-bold">おつかれさまでした！</p>
          <p className="mt-1 text-sm text-ink-muted">
            {done}回 答えました。思い出そうとした時間が、そのまま記憶を強くしています。
          </p>
          <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-2xl bg-success-soft p-3">
              <dt>覚えた</dt>
              <dd className="text-2xl font-bold">{tally.got_it}</dd>
            </div>
            <div className="rounded-2xl bg-warning-soft p-3">
              <dt>あやふや</dt>
              <dd className="text-2xl font-bold">{tally.close}</dd>
            </div>
            <div className="rounded-2xl bg-danger-soft p-3">
              <dt>忘れた</dt>
              <dd className="text-2xl font-bold">{tally.again}</dd>
            </div>
          </dl>
        </Card>
        {carriedOver > 0 && (
          <p className="mt-3 text-center text-sm text-ink-muted">
            残りの{carriedOver}件は明日以降に出題されます。自分のペースで大丈夫です。
          </p>
        )}
        <div className="mt-4 grid gap-2">
          <LinkButton href={routes.newWord} full icon={PencilLine}>
            新しい単語を登録
          </LinkButton>
          <LinkButton href="/" full variant="secondary">
            ホームへ
          </LinkButton>
        </div>
      </div>
    );
  }

  if (!entry || !state) {
    // 復習中に削除された等
    return (
      <div>
        <PageHeader title={title} back={backHref} />
        <Notice tone="info">この項目は削除されました。</Notice>
        <Button className="mt-4" full onClick={() => setPosition((p) => p + 1)}>
          次へ
        </Button>
      </div>
    );
  }

  const isRetry = retried.has(entry.id);
  const meaning = primaryMeaning(entry);
  const firstExample = entry.senses.flatMap((x) => x.examples)[0];
  const mode = snapshot.settings.reviewMode;
  const speakProps = { speakingText: tts.speakingText, onSpeak: tts.speak, onStop: tts.stop, supported: tts.supported };

  async function rate(rating: ReviewRating) {
    if (!entryId || submittingRef.current) return; // 連打対策
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const outcome = await run((r) =>
        r.recordReview({ attemptId, entryId, rating, source: manual ? "manual" : "auto", isRetry }),
      );
      setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
      if (outcome.requeueInSession) {
        setQueue((q) => (q ? [...q, entryId] : q));
        setRetried((r) => new Set(r).add(entryId));
      }
      setPosition((p) => p + 1);
      setAttemptId(createId());
      setRevealed(false);
      setShowHint(false);
      setAnswer("");
      tts.stop();
    } catch {
      // 同じ attemptId のまま再送できるので、二重登録にはならない
      setError("記録できませんでした。もう一度お試しください。");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  const ratingButtons: Array<{ rating: ReviewRating; label: string; cls: string }> = [
    { rating: "again", label: REVIEW_RATING_LABELS.again, cls: "bg-danger-soft text-danger" },
    { rating: "close", label: REVIEW_RATING_LABELS.close, cls: "bg-warning-soft text-warning" },
    { rating: "got_it", label: REVIEW_RATING_LABELS.got_it, cls: "bg-success-soft text-success" },
  ];

  return (
    <div>
      <PageHeader title={manual ? title : `${title}（${total}問中 ${position + 1}問目）`} back={backHref} />
      {hadOverdue && position === 0 && (
        <p className="mb-3 text-center text-xs text-ink-muted">
          前回までの分も一緒に出題しています。ゆっくりで大丈夫です。
        </p>
      )}

      <div
        className="mb-4 h-2 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={position}
        aria-label="復習の進み具合"
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(position / total) * 100}%` }}
        />
      </div>

      <div className="space-y-4">
        <Card>
          <div className="mb-2 flex items-center gap-2">
            <Chip tone="muted">{ENTRY_KIND_LABELS[entry.kind]}</Chip>
            {isRetry && <Chip tone="warning">再挑戦</Chip>}
          </div>
          {meaning ? (
            <>
              <p className="text-xs font-bold text-ink-muted">この意味の英語は？</p>
              <p className="text-xl font-bold leading-relaxed">{meaning}</p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold text-ink-muted">この英語の意味や使い方を思い出そう</p>
              <p className="english text-2xl font-bold">{entry.headword}</p>
            </>
          )}
        </Card>

        {!revealed ? (
          <>
            <EnglishAnswerInput
              value={answer}
              onChange={setAnswer}
              method={method}
              onMethodChange={setMethod}
              label="英語で言ってみよう"
              placeholder="まず声に出してから、書いてもOK"
              reference={meaning || entry.headword}
            />
            <div className="rounded-2xl border border-line bg-surface p-4">
              <button
                type="button"
                className="flex w-full items-center gap-2 font-bold"
                aria-expanded={showHint}
                onClick={() => setShowHint((v) => !v)}
              >
                <Lightbulb size={20} className="text-warning" aria-hidden />
                ヒント
              </button>
              {showHint && <p className="english mt-2 break-words text-ink-muted">{hintOf(entry.headword)}</p>}
            </div>
            <div className="sticky bottom-above-nav z-10 -mx-4 bg-gradient-to-t from-bg from-60% to-transparent px-4 pt-5 pb-3">
              <Button full icon={Eye} onClick={() => setRevealed(true)}>
                答えを確認する
              </Button>
            </div>
          </>
        ) : (
          <>
            {answer.trim() && (
              <Card tone="muted">
                <p className="mb-1 text-xs font-bold text-ink-muted">あなたの回答</p>
                <p className="english text-lg">{answer}</p>
              </Card>
            )}
            <Card tone="success">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-sm font-bold text-success">答え</p>
                  <p className="english text-2xl font-bold">{entry.headword}</p>
                  {entry.ipa && <p className="english text-sm text-ink-muted">{entry.ipa}</p>}
                  {meaning && <p className="mt-1 font-bold">{meaning}</p>}
                </div>
                <SpeakButton text={entry.headword} {...speakProps} />
              </div>
              {firstExample && (
                <div className="mt-3 flex items-start gap-2 border-t border-line pt-3">
                  <div className="min-w-0 flex-1">
                    <p className="english text-sm">{firstExample.en}</p>
                    {firstExample.ja && <p className="text-xs text-ink-muted">{firstExample.ja}</p>}
                  </div>
                  <SpeakButton text={firstExample.en} {...speakProps} />
                </div>
              )}
              {entry.alternatives.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-line pt-3">
                  {entry.alternatives.slice(0, 3).map((a) => (
                    <li key={a} className="flex items-center gap-2">
                      <p className="english min-w-0 flex-1 text-sm">{a}</p>
                      <SpeakButton text={a} {...speakProps} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <p className="text-center text-sm text-ink-muted">思い出せましたか？ 正直に選びましょう</p>
            {error && <Notice tone="danger">{error}</Notice>}
            <div className="grid grid-cols-3 gap-2">
              {ratingButtons.map((b) => (
                <button
                  key={b.rating}
                  type="button"
                  disabled={busy}
                  onClick={() => void rate(b.rating)}
                  className={cn(
                    "flex min-h-20 flex-col items-center justify-center rounded-2xl font-bold transition-transform active:scale-95 disabled:opacity-60",
                    b.cls,
                  )}
                >
                  <span className="text-base">{b.label}</span>
                  <span className="text-xs font-normal">{ratingSub(state, b.rating, mode, isRetry, today)}</span>
                </button>
              ))}
            </div>
            <p className="flex items-center justify-center gap-1 text-xs text-ink-subtle">
              <RotateCcw size={12} aria-hidden />
              {isRetry
                ? "再挑戦は練習です。連続成功の回数には数えません"
                : `「覚えた」が${MASTERY_STREAK}回続くと「習得済み」になります`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
