"use client";

import { Keyboard, Mic, MicOff, Square } from "lucide-react";
import { useCallback, useId, type ReactNode } from "react";

import { ENGLISH_MAX, type InputMethod } from "@/lib/schemas";
import { useSpeechRecognition } from "@/lib/speech/use-speech-recognition";

import { FocusTextarea } from "./focus-textarea";
import { Notice, SegmentedControl, cn } from "./ui";

/**
 * 英文の入力欄（文字／音声切替）。
 * 音声認識の結果はテキスト欄に入り、そのまま編集できる。
 * 非対応ブラウザでは音声タブを押すと案内を出し、文字入力を使ってもらう。
 */
export function EnglishAnswerInput({
  value,
  onChange,
  method,
  onMethodChange,
  lang = "en-US",
  label = "英語で表現してみよう",
  placeholder = "I was...",
  reference,
}: {
  value: string;
  onChange: (v: string) => void;
  method: InputMethod;
  onMethodChange: (m: InputMethod) => void;
  lang?: string;
  label?: string;
  placeholder?: string;
  /** 集中入力モードで上に出す参考（元の日本語など） */
  reference?: ReactNode;
}) {
  const id = useId();
  const append = useCallback(
    (text: string) => {
      const next = value.trim() ? `${value.trim()} ${text}` : text;
      onChange(next.slice(0, ENGLISH_MAX));
    },
    [onChange, value],
  );
  const speech = useSpeechRecognition({ lang, onFinal: append });

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block font-bold">
        {label}
      </label>
      <SegmentedControl<InputMethod>
        label="入力方法"
        value={method}
        onChange={(m) => {
          if (m === "text" && speech.listening) speech.stop();
          onMethodChange(m);
        }}
        options={[
          { value: "text", label: "文字入力", icon: Keyboard },
          { value: "voice", label: "音声入力", icon: Mic },
        ]}
      />

      {method === "voice" && !speech.supported && (
        <Notice tone="warning" title="このブラウザは音声入力に対応していません">
          Chrome・Edge・Safari などでお試しください。下の欄に文字で入力することもできます。
        </Notice>
      )}

      {method === "voice" && speech.supported && (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-surface-muted px-4 py-5">
          <button
            type="button"
            onClick={speech.listening ? speech.stop : speech.start}
            className={cn(
              "flex size-20 items-center justify-center rounded-full text-on-primary shadow-card transition-transform active:scale-95",
              speech.listening ? "animate-pulse bg-danger" : "bg-primary hover:bg-primary-strong",
            )}
            aria-label={speech.listening ? "録音を停止" : "英語で話す（録音開始）"}
            aria-pressed={speech.listening}
          >
            {speech.listening ? <Square size={28} aria-hidden /> : <Mic size={34} aria-hidden />}
          </button>
          <p className="text-sm font-bold" aria-live="polite">
            {speech.listening ? "聞き取り中… 話し終わったらタップ" : "タップして英語で話す"}
          </p>
          {speech.interim && <p className="english text-center text-ink-muted">{speech.interim}</p>}
          {speech.error && (
            <p className="flex items-center gap-1 text-sm text-danger" role="alert">
              <MicOff size={16} aria-hidden />
              {speech.error}
            </p>
          )}
          <p className="text-center text-xs text-ink-subtle">
            認識結果は下の欄に入ります。間違っていたら直してください。発音の採点はしません。
          </p>
        </div>
      )}

      <div>
        <FocusTextarea
          id={id}
          value={value}
          onChange={onChange}
          maxLength={ENGLISH_MAX}
          rows={3}
          placeholder={placeholder}
          label={label}
          reference={reference}
          english
        />
      </div>
    </div>
  );
}
