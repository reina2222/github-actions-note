/**
 * 読み上げ音声の選択（純粋関数）
 *
 * ブラウザの既定音声は端末の言語（日本語）になっていることが多く、
 * 英文を日本語音声で読むと「カタコト」になる。必ず英語の音声を選ぶ。
 */

export type VoiceLike = {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
};

export type VoiceAccent = "en-US" | "en-GB";

/** Android などで "en_US" 表記になる場合があるので正規化 */
export function normalizeLang(lang: string): string {
  return lang.replace("_", "-").toLowerCase();
}

export function isEnglishVoice(v: VoiceLike): boolean {
  return normalizeLang(v.lang).startsWith("en");
}

// 自然に聞こえることが多い音声（Chrome / Safari / Edge / Android）
const PREFERRED: Record<VoiceAccent, RegExp[]> = {
  "en-US": [
    /Microsoft (Aria|Jenny|Guy|Ava|Andrew|Emma|Brian).*Natural/i,
    /Google US English/i,
    /\b(Samantha|Ava|Allison|Susan|Zoe|Evan|Nathan|Tom)\b/i,
    /\bAlex\b/i,
  ],
  "en-GB": [
    /Microsoft (Sonia|Ryan|Libby|Maisie|Thomas).*Natural/i,
    /Google UK English/i,
    /\b(Daniel|Serena|Kate|Oliver|Stephanie|Arthur|Martha)\b/i,
  ],
};

// macOS の効果音的な音声など、学習用に向かないもの
const NOVELTY =
  /\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Fred|Good News|Hysterical|Jester|Junior|Kathy|Organ|Pipe Organ|Princess|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox|Grandma|Grandpa|Eddy|Flo|Reed|Rocko|Sandy|Shelley)\b/i;

/**
 * 学習用に向かない音声か。
 * 日本語設定の iPhone では「ささやき」「オルガン」のように名前が日本語になるため、
 * 名前だけでなく voiceURI（com.apple.speech.synthesis.voice.* / com.apple.eloquence.*）でも判定する。
 */
export function isNoveltyVoice(v: VoiceLike): boolean {
  if (NOVELTY.test(v.name)) return true;
  if (/com\.apple\.(speech\.synthesis\.voice|eloquence)\./i.test(v.voiceURI)) return true;
  // 英語の音声なのに名前が日本語（ローカライズされた効果音系の声）
  if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(v.name) && !/Samantha/i.test(v.name)) return true;
  return false;
}

/** アプリで使う声（Samantha）か */
export function isSamantha(v: VoiceLike): boolean {
  return /\bSamantha\b/i.test(v.name) || /\.Samantha$/i.test(v.voiceURI);
}

export function scoreVoice(v: VoiceLike, accent: VoiceAccent): number {
  if (!isEnglishVoice(v)) return -Infinity;
  let score = 0;
  const lang = normalizeLang(v.lang);
  if (lang === accent.toLowerCase()) score += 100;
  else if (accent === "en-GB" && lang === "en-ie") score += 20;
  else score += 10; // 別地域の英語（豪・印など）でも日本語音声よりはずっと良い
  const prefs = PREFERRED[accent];
  const idx = prefs.findIndex((re) => re.test(v.name));
  if (idx >= 0) score += 50 - idx * 5;
  if (/(Enhanced|Premium|Natural|Neural)/i.test(v.name)) score += 30;
  if (isSamantha(v)) score += 500; // このアプリの標準の声
  if (isNoveltyVoice(v)) score -= 1000;
  return score;
}

/** アクセントに合う英語音声を良い順に並べる */
export function rankVoices<T extends VoiceLike>(voices: readonly T[], accent: VoiceAccent): T[] {
  return voices
    .filter((v) => isEnglishVoice(v) && !isNoveltyVoice(v))
    .map((v) => ({ v, s: scoreVoice(v, accent) }))
    .sort((a, b) => b.s - a.s || a.v.name.localeCompare(b.v.name))
    .map((x) => x.v);
}

/**
 * 使う音声を決める。
 * 1. ユーザーが選んだ音声（まだ存在すれば）
 * 2. アクセントに合う一番良い英語音声
 * 英語音声が1つもなければ null（lang だけ指定して読み上げる）
 */
export function pickVoice<T extends VoiceLike>(
  voices: readonly T[],
  accent: VoiceAccent,
  preferredURI?: string | null,
): T | null {
  if (preferredURI) {
    const chosen = voices.find((v) => v.voiceURI === preferredURI && isEnglishVoice(v));
    if (chosen) return chosen;
  }
  return rankVoices(voices, accent)[0] ?? null;
}
