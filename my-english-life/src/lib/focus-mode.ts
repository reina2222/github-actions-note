"use client";

/**
 * 集中入力モードの状態（アプリ全体で1つ）
 * 入力欄にフォーカスしている間 true。ページヘッダーと下部ナビが参照して非表示になる。
 */
import { useSyncExternalStore } from "react";

let active = false;
const listeners = new Set<() => void>();

export function setFocusMode(next: boolean) {
  if (active === next) return;
  active = next;
  listeners.forEach((l) => l());
}

export function isFocusModeActive() {
  return active;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useFocusMode(): boolean {
  return useSyncExternalStore(subscribe, isFocusModeActive, () => false);
}
