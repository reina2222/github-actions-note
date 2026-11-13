"use client";

import { useLearning } from "../store/learning-provider";
import { useTts } from "./tts";

/**
 * アプリ共通の読み上げ。声は Samantha（アメリカ英語）に固定。
 * 端末に Samantha が無い場合（Android・Windows など）は、近いアメリカ英語の声を自動で使う。
 * 速さだけマイページで変更できる。
 */
export function useAppTts() {
  const { snapshot } = useLearning();
  return useTts({ lang: "en-US", rate: snapshot?.settings.speechRate ?? 0.9, voiceURI: null });
}
