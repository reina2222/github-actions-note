import { describe, expect, it } from "vitest";

import { pickVoice, rankVoices, type VoiceLike } from "@/lib/speech/voice-select";

const v = (name: string, lang: string, localService = true): VoiceLike => ({
  name,
  lang,
  voiceURI: `uri:${name}`,
  localService,
});

// iPhone / Mac の日本語環境でよくある並び（先頭が日本語の既定音声）
const VOICES = [
  v("Kyoko", "ja-JP"),
  v("Albert", "en-US"),
  v("Fred", "en-US"),
  v("Samantha", "en-US"),
  v("Daniel", "en-GB"),
  v("Karen", "en-AU"),
  v("Google UK English Female", "en-GB", false),
];

describe("pickVoice", () => {
  it("never picks a Japanese voice for English", () => {
    expect(pickVoice([v("Kyoko", "ja-JP"), v("Otoya", "ja-JP")], "en-US")).toBeNull();
  });

  it("picks a natural US voice and skips novelty voices", () => {
    expect(pickVoice(VOICES, "en-US")?.name).toBe("Samantha");
  });

  it("app standard is Samantha even for en-GB; without Samantha a British voice is chosen", () => {
    expect(pickVoice(VOICES, "en-GB")?.name).toBe("Samantha");
    expect(
      pickVoice(
        VOICES.filter((v) => v.name !== "Samantha"),
        "en-GB",
      )?.lang,
    ).toBe("en-GB");
  });

  it("handles Android style en_US", () => {
    expect(pickVoice([v("Kyoko", "ja_JP"), v("English United States", "en_US")], "en-US")?.name).toBe(
      "English United States",
    );
  });

  it("falls back to another English accent rather than Japanese", () => {
    expect(pickVoice([v("Kyoko", "ja-JP"), v("Karen", "en-AU")], "en-GB")?.name).toBe("Karen");
  });

  it("respects the user's choice if it still exists", () => {
    expect(pickVoice(VOICES, "en-US", "uri:Daniel")?.name).toBe("Daniel");
    expect(pickVoice(VOICES, "en-US", "uri:Removed")?.name).toBe("Samantha");
    expect(pickVoice(VOICES, "en-US", "uri:Kyoko")?.name).toBe("Samantha");
  });

  it("rankVoices excludes Japanese and novelty voices", () => {
    const names = rankVoices(VOICES, "en-US").map((x) => x.name);
    expect(names.includes("Kyoko")).toBe(false);
    expect(names.includes("Albert")).toBe(false);
    expect(names[0]).toBe("Samantha");
  });
});

describe("Samantha only / no novelty voices (Japanese iPhone)", () => {
  const jp = [
    { name: "Kyoko", lang: "ja-JP", voiceURI: "com.apple.voice.compact.ja-JP.Kyoko", localService: true },
    { name: "ささやき", lang: "en-US", voiceURI: "com.apple.speech.synthesis.voice.Whisper", localService: true },
    { name: "オルガン", lang: "en-US", voiceURI: "com.apple.speech.synthesis.voice.Organ", localService: true },
    { name: "Eddy（英語（米国））", lang: "en-US", voiceURI: "com.apple.eloquence.en-US.Eddy", localService: true },
    { name: "Fred", lang: "en-US", voiceURI: "com.apple.speech.synthesis.voice.Fred", localService: true },
    { name: "Daniel", lang: "en-GB", voiceURI: "com.apple.voice.compact.en-GB.Daniel", localService: true },
    { name: "Samantha", lang: "en-US", voiceURI: "com.apple.voice.compact.en-US.Samantha", localService: true },
  ];

  it("always picks Samantha when available", () => {
    expect(pickVoice(jp, "en-US")?.name).toBe("Samantha");
    expect(pickVoice(jp, "en-GB")?.name).toBe("Samantha");
  });

  it("never offers whisper/organ/eloquence voices", () => {
    const names = rankVoices(jp, "en-US").map((v) => v.name);
    expect(names).toEqual(["Samantha", "Daniel"]);
  });

  it("falls back to a normal US voice when Samantha is missing (Android)", () => {
    const android = [
      { name: "日本語 日本", lang: "ja_JP", voiceURI: "ja-jp", localService: true },
      { name: "English United States", lang: "en_US", voiceURI: "en-us", localService: true },
    ];
    expect(pickVoice(android, "en-US")?.name).toBe("English United States");
  });
});
