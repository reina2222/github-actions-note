"use client";

/**
 * ブラウザ音声認識（Web Speech API）
 * - 対応ブラウザ: Chrome / Edge / Safari（iOS 14.5+）など。Firefox は非対応。
 * - 非対応の場合は supported=false を返し、画面側で文字入力にフォールバックする。
 * - 認識結果は「文字起こし」であり、発音の良し悪しの採点には使わない。
 * - Chrome では音声がブラウザ提供元のサーバーで処理される場合がある（画面で案内する）。
 */
import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionAlternative = { transcript: string };
type RecognitionResult = { isFinal: boolean; 0: RecognitionAlternative; length: number };
type RecognitionEvent = { resultIndex: number; results: { length: number; [i: number]: RecognitionResult } };
type RecognitionErrorEvent = { error: string };

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** エラー内容を、端末に合わせた分かりやすい案内にする */
export function speechErrorMessage(error: string, env: { ios: boolean; standalone: boolean; online: boolean }): string {
  switch (error) {
    case "not-allowed":
      return env.ios
        ? "マイクが許可されていません。iPhone の「設定 → アプリ → Safari → マイク」で「確認」または「許可」にしてください。"
        : "マイクが許可されていません。アドレスバーの鍵マークなどから、このサイトのマイクを許可してください。";
    case "service-not-allowed":
      if (env.ios && env.standalone)
        return "ホーム画面から開いたアプリでは、音声入力が使えないことがあります。Safari で開くか、文字入力をお使いください。";
      if (env.ios)
        return "音声認識を使えませんでした。iPhone の「設定 → 一般 → キーボード → 音声入力」をオンにしてください。";
      return "この環境では音声認識を利用できません。文字入力をお使いください。";
    case "no-speech":
      return "音声が聞き取れませんでした。もう一度、マイクに近づいて話してみてください。";
    case "audio-capture":
      return "マイクが見つかりません。ほかのアプリがマイクを使っていないか確認してください。";
    case "network":
      return env.online
        ? "音声認識の通信に失敗しました。少し待ってからもう一度お試しください。"
        : "オフラインのため音声入力が使えません。文字入力をお使いください。";
    default:
      return "音声認識でエラーが発生しました。文字入力もお使いいただけます。";
  }
}

export type SpeechRecognitionState = {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
};

export function useSpeechRecognition(options: {
  lang?: string;
  onFinal: (text: string) => void;
}): SpeechRecognitionState {
  const { lang = "en-US", onFinal } = options;
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => recRef.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("このブラウザは音声入力に対応していません。文字入力をお使いください。");
      return;
    }
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) onFinalRef.current(finalText.trim());
    };
    rec.onerror = (e) => {
      if (e.error !== "aborted")
        setError(speechErrorMessage(e.error, { ios: isIOS(), standalone: isStandalone(), online: navigator.onLine }));
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recRef.current = rec;
    setError(null);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      setError("音声認識を開始できませんでした。");
    }
  }, [lang]);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  return { supported, listening, interim, error, start, stop };
}
