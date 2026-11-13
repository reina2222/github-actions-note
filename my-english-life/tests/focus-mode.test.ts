import { describe, expect, it } from "vitest";

import { isFocusModeActive, setFocusMode } from "@/lib/focus-mode";
import { readViewport } from "@/lib/use-visual-viewport";

describe("focus mode store", () => {
  it("toggles and is idempotent", () => {
    expect(isFocusModeActive()).toBe(false);
    setFocusMode(true);
    setFocusMode(true);
    expect(isFocusModeActive()).toBe(true);
    setFocusMode(false);
    expect(isFocusModeActive()).toBe(false);
  });

  it("readViewport is safe outside the browser", () => {
    expect(readViewport()).toEqual({ height: 0, offsetTop: 0 });
  });
});

import { speechErrorMessage } from "@/lib/speech/use-speech-recognition";

describe("speech error messages", () => {
  const base = { ios: false, standalone: false, online: true };
  it("gives iPhone-specific guidance", () => {
    expect(speechErrorMessage("not-allowed", { ...base, ios: true }).includes("設定")).toBe(true);
    expect(speechErrorMessage("service-not-allowed", { ...base, ios: true, standalone: true }).includes("Safari")).toBe(
      true,
    );
    expect(speechErrorMessage("service-not-allowed", { ...base, ios: true }).includes("音声入力")).toBe(true);
  });
  it("explains offline network errors", () => {
    expect(speechErrorMessage("network", { ...base, online: false }).includes("オフライン")).toBe(true);
  });
});
