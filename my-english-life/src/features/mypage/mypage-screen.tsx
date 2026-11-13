"use client";

import { Gauge, RotateCcw, Minus, Monitor, Moon, Plus, Sun, Target, Trash2, Volume2 } from "lucide-react";
import { useState } from "react";

import {
  Button,
  Card,
  LoadingBlock,
  Notice,
  PageHeader,
  SectionTitle,
  SegmentedControl,
  StoreError,
  Switch,
  cn,
} from "@/components/ui";
import { CEFR_LABELS, CEFR_LEVELS } from "@/lib/schemas";
import type { ReviewMode } from "@/lib/srs";
import { useAppTts } from "@/lib/speech/use-app-tts";

import { useLearning } from "@/lib/store/learning-provider";
import type { Settings, ThemeSetting } from "@/lib/store/types";

import { BackupSection } from "./backup-section";

const RATE_OPTIONS = [
  { value: "0.75", label: "ゆっくり" },
  { value: "0.9", label: "ふつう" },
  { value: "1.1", label: "速め" },
] as const;

export function MyPageScreen() {
  const { snapshot, status, run } = useLearning();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const tts = useAppTts();

  if (status === "error")
    return (
      <div className="pt-6">
        <StoreError />
      </div>
    );
  if (!snapshot) {
    return (
      <div>
        <PageHeader title="マイページ" />
        <LoadingBlock />
      </div>
    );
  }

  const settings = snapshot.settings;
  const update = (patch: Partial<Settings>) =>
    run((r) => r.updateSettings(patch)).catch(() => setMessage("設定を保存できませんでした。"));
  const rateValue = RATE_OPTIONS.reduce((best, o) =>
    Math.abs(Number(o.value) - settings.speechRate) < Math.abs(Number(best.value) - settings.speechRate) ? o : best,
  ).value;

  return (
    <div>
      <PageHeader title="マイページ" />
      <div className="space-y-4">
        {message && <Notice tone="info">{message}</Notice>}

        <Card>
          <SectionTitle icon={Gauge}>英語レベル（CEFR）</SectionTitle>
          <p className="mb-3 text-xs text-ink-muted">
            あなたの今の英語レベルの目安です。カード学習で、このレベルの例文を優先して表示する予定です（レベル未設定の例文も表示されます）。
          </p>
          <div className="grid gap-2" role="radiogroup" aria-label="英語レベル">
            {CEFR_LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                role="radio"
                aria-checked={settings.level === lv}
                onClick={() => void update({ level: lv })}
                className={cn(
                  "flex min-h-12 items-center rounded-2xl border px-4 text-left text-sm font-bold",
                  settings.level === lv ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface",
                )}
              >
                {CEFR_LABELS[lv]}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Target}>学習目標</SectionTitle>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold">1週間に学習する日数</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex size-11 items-center justify-center rounded-full border border-line bg-surface disabled:opacity-40"
                onClick={() => void update({ weeklyGoalDays: settings.weeklyGoalDays - 1 })}
                disabled={settings.weeklyGoalDays <= 1}
                aria-label="1日減らす"
              >
                <Minus size={18} aria-hidden />
              </button>
              <span className="w-12 text-center text-xl font-bold tabular-nums" aria-live="polite">
                {settings.weeklyGoalDays}日
              </span>
              <button
                type="button"
                className="flex size-11 items-center justify-center rounded-full border border-line bg-surface disabled:opacity-40"
                onClick={() => void update({ weeklyGoalDays: settings.weeklyGoalDays + 1 })}
                disabled={settings.weeklyGoalDays >= 7}
                aria-label="1日増やす"
              >
                <Plus size={18} aria-hidden />
              </button>
            </div>
          </div>
          <label className="mt-4 block text-sm font-bold" htmlFor="goal-text">
            目標メモ（任意）
          </label>
          <input
            id="goal-text"
            key={settings.goalText}
            defaultValue={settings.goalText}
            maxLength={100}
            onBlur={(e) => {
              const goalText = e.target.value.trim();
              if (goalText !== settings.goalText) void update({ goalText });
            }}
            placeholder="例）海外旅行で困らないくらい話したい"
            className="mt-1 block min-h-12 w-full rounded-2xl border border-line bg-surface px-4 placeholder:text-ink-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Card>

        <Card>
          <SectionTitle icon={RotateCcw}>復習設定</SectionTitle>
          <div className="divide-y divide-line">
            <Switch
              label="自動復習"
              description="復習のタイミングが来たフレーズを、今日の復習として出題します"
              checked={settings.autoReview}
              onChange={(autoReview) => void update({ autoReview })}
            />
            <Switch
              label="起動時のお知らせ"
              description="今日の復習があるとき、ホームでお知らせします"
              checked={settings.launchNotice}
              disabled={!settings.autoReview}
              onChange={(launchNotice) => void update({ launchNotice })}
            />
          </div>
          {!settings.autoReview && (
            <p className="mt-2 text-xs text-ink-muted">
              OFFの間も、保存したフレーズと学習履歴はそのまま残ります。ノートからはいつでも復習できます。
            </p>
          )}
          <div className={cn("mt-4 space-y-4", !settings.autoReview && "opacity-50")}>
            <div>
              <p className="mb-1.5 text-sm font-bold">1日の復習上限</p>
              <SegmentedControl
                label="1日の復習上限"
                value={settings.dailyLimit === null ? "none" : String(settings.dailyLimit)}
                options={[
                  { value: "5", label: "5" },
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                  { value: "none", label: "無制限" },
                ]}
                onChange={(v) => void update({ dailyLimit: v === "none" ? null : (Number(v) as 5 | 10 | 20) })}
              />
              <p className="mt-1 text-xs text-ink-subtle">上限を超えた分は、消えずに翌日以降へ持ち越されます。</p>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-bold">復習モード</p>
              <SegmentedControl<ReviewMode>
                label="復習モード"
                value={settings.reviewMode}
                options={[
                  { value: "adaptive", label: "適応型" },
                  { value: "fixed", label: "固定間隔" },
                ]}
                onChange={(reviewMode) => void update({ reviewMode })}
              />
              <p className="mt-1 text-xs text-ink-subtle">
                {settings.reviewMode === "adaptive"
                  ? "「できた」が続くほど間隔がのび、「もう一度」「惜しい」は翌日にまた出題します。"
                  : "保存した日から 1・3・7・14・30・60日後 に、決まった日程で出題します。"}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Volume2}>音声設定</SectionTitle>
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-sm font-bold">読み上げの速さ</p>
              <SegmentedControl
                label="読み上げの速さ"
                value={rateValue}
                options={RATE_OPTIONS}
                onChange={(v) => void update({ speechRate: Number(v) })}
              />
            </div>
            <p className="text-sm">
              読み上げの声：<b className="english">Samantha</b>（アメリカ英語）
              <span className="block text-xs text-ink-subtle">
                端末に Samantha が無い場合は、近いアメリカ英語の声で読み上げます。
              </span>
            </p>
            {tts.supported ? (
              <Button
                variant="secondary"
                size="md"
                full
                icon={Volume2}
                onClick={() => tts.speak("Nice to meet you. How was your day?")}
              >
                試しに聞いてみる
              </Button>
            ) : (
              <p className="text-xs text-ink-muted">このブラウザは読み上げに対応していません。</p>
            )}
            <p className="text-xs text-ink-subtle">
              音声入力は英語の文字起こしに使います。発音の良し悪しの採点はしません。一部のブラウザでは、音声がブラウザ提供元のサーバーで処理される場合があります。
            </p>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Sun}>画面の表示</SectionTitle>
          <SegmentedControl<ThemeSetting>
            label="テーマ"
            value={settings.theme}
            options={[
              { value: "system", label: "自動", icon: Monitor },
              { value: "light", label: "ライト", icon: Sun },
              { value: "dark", label: "ダーク", icon: Moon },
            ]}
            onChange={(theme) => void update({ theme })}
          />
        </Card>

        <BackupSection />

        <Card>
          <SectionTitle icon={Trash2}>データ管理</SectionTitle>
          <div className="space-y-2">
            {confirmClear ? (
              <div className="rounded-2xl bg-danger-soft p-4">
                <p className="text-sm font-bold">この端末の学習データをすべて削除しますか？</p>
                <p className="mt-1 text-xs text-ink-muted">
                  単語帳・復習記録・設定が消え、元に戻せません。先にバックアップを保存することをおすすめします。
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="md" onClick={() => setConfirmClear(false)}>
                    やめる
                  </Button>
                  <Button
                    variant="danger"
                    size="md"
                    onClick={async () => {
                      await run((r) => r.clearAll());
                      setConfirmClear(false);
                      setMessage("この端末の学習データを削除しました。");
                    }}
                  >
                    削除する
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" size="md" full onClick={() => setConfirmClear(true)}>
                この端末のデータをすべて削除
              </Button>
            )}
          </div>
        </Card>

        <p className="pb-2 text-center text-xs text-ink-subtle">My English Life 2.0（Phase 1）・AI 不使用・無料</p>
      </div>
    </div>
  );
}
