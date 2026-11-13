"use client";

/**
 * ブラウザ TTS（speechSynthesis）で英文を読み上げる。
 *
 * 注意: getVoices() は最初は空のことが多く、voiceschanged イベントの後に揃う。
 * 揃う前に読み上げると端末既定（日本語）の音声になり、英語がカタコトになるため、
 * 音声一覧を購読して、毎回必ず英語の音声を指定する。
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { pickVoice, rankVoices, type VoiceAccent } from "./voice-select";

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/** 端末の音声一覧（読み込み完了を待って更新される） */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!isTtsSupported()) return;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices());
    load();
    synth.addEventListener("voiceschanged", load);
    // 一部ブラウザは voiceschanged を出さないので、少し待って再取得
    const timer = window.setTimeout(load, 1000);
    return () => {
      synth.removeEventListener("voiceschanged", load);
      window.clearTimeout(timer);
    };
  }, []);
  return voices;
}

export function useEnglishVoices(accent: VoiceAccent): SpeechSynthesisVoice[] {
  return rankVoices(useVoices(), accent);
}

export function useTts(options: { lang: VoiceAccent; rate: number; voiceURI?: string | null }) {
  const [supported, setSupported] = useState(false);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const voices = useVoices();
  const voicesRef = useRef(voices);

  useEffect(() => {
    voicesRef.current = voices;
  }, [voices]);

  useEffect(() => {
    setSupported(isTtsSupported());
    return () => {
      if (isTtsSupported()) window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (!isTtsSupported()) return;
    window.speechSynthesis.cancel();
    setSpeakingText(null);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isTtsSupported()) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const available = voicesRef.current.length ? voicesRef.current : synth.getVoices();
      const voice = pickVoice(available, options.lang, options.voiceURI);
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voice?.lang.replace("_", "-") ?? options.lang;
      if (voice) u.voice = voice;
      u.rate = options.rate;
      u.onend = () => setSpeakingText(null);
      u.onerror = () => setSpeakingText(null);
      setSpeakingText(text);
      synth.speak(u);
    },
    [options.lang, options.rate, options.voiceURI],
  );

  return { supported, speakingText, speak, stop };
}
