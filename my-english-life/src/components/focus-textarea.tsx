"use client";

/**
 * 集中入力モード付きのテキスト入力欄
 * ------------------------------------------------------------
 * スマホ（タッチ操作の端末）で入力欄にフォーカスすると:
 *   - 入力欄を「キーボードの上に見えている範囲」いっぱいに広げる（visualViewport 基準。100vh は使わない）
 *   - ページヘッダーと下部ナビを隠す（focus-mode ストア経由）
 *   - 上部に「完了」ボタンを出す。押すかキーボードを閉じると通常画面に戻る
 *
 * 同じ <textarea> 要素のままクラスだけ切り替えるので、フォーカス・カーソル位置・入力中の変換は失われない。
 * 元の位置には同じ高さの空白を置き、背後のページがずれたりスクロール位置が飛んだりしないようにする。
 * PC（マウス操作）では通常の入力欄のまま。
 */
import { Check } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";

import { setFocusMode } from "@/lib/focus-mode";
import { useVisualViewport } from "@/lib/use-visual-viewport";

import { cn } from "./ui";

function isTouchDevice(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export type FocusTextareaProps = {
  id: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  placeholder?: string;
  rows?: number;
  /** 集中入力モードの上部に出す見出し */
  label: string;
  /** 集中入力モードで入力欄の上に出す参考情報（英作文なら元の日本語） */
  reference?: ReactNode;
  english?: boolean;
  className?: string;
};

export const FocusTextarea = forwardRef<HTMLTextAreaElement, FocusTextareaProps>(function FocusTextarea(
  { id, value, onChange, maxLength, placeholder, rows = 3, label, reference, english = false, className },
  forwardedRef,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement);

  const [focused, setFocused] = useState(false);
  const [spacer, setSpacer] = useState(0);
  const savedScroll = useRef(0);
  const focusedRef = useRef(false);
  const viewport = useVisualViewport(focused);

  const enter = useCallback(() => {
    if (!isTouchDevice()) return;
    focusedRef.current = true;
    savedScroll.current = window.scrollY;
    setSpacer(wrapRef.current?.offsetHeight ?? 0);
    setFocused(true);
    setFocusMode(true);
  }, []);

  const exit = useCallback(() => {
    if (!focusedRef.current) return;
    focusedRef.current = false;
    setFocused(false);
    setFocusMode(false);
    // レイアウトが戻った後、入力前のスクロール位置に戻す（ガタつき防止）
    requestAnimationFrame(() => window.scrollTo({ top: savedScroll.current, behavior: "instant" as ScrollBehavior }));
  }, []);

  // ページ移動などで入力欄が消えたら、必ず通常表示に戻す
  useEffect(() => () => setFocusMode(false), []);

  // 集中入力モードに入ったら、カーソル位置が見えるように入力欄の中だけをスクロール
  useEffect(() => {
    if (!focused || !viewport) return;
    const el = textareaRef.current;
    if (!el) return;
    if (el.selectionEnd === el.value.length) el.scrollTop = el.scrollHeight;
  }, [focused, viewport]);

  const count = value.length;

  return (
    <>
      {focused && <div style={{ height: spacer }} aria-hidden />}
      <div
        ref={wrapRef}
        className={cn(focused && "fixed inset-x-0 z-50 flex flex-col bg-bg px-4 pb-2")}
        style={
          focused
            ? {
                top: viewport?.offsetTop ?? 0,
                height: viewport ? viewport.height : "100dvh",
                paddingTop: "max(0.5rem, env(safe-area-inset-top))",
              }
            : undefined
        }
        role={focused ? "group" : undefined}
        aria-label={focused ? `${label}（集中入力）` : undefined}
      >
        {focused && (
          <div className="flex min-h-12 shrink-0 items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-bold">{label}</p>
            <span
              className={cn("text-xs tabular-nums", count >= maxLength ? "text-danger" : "text-ink-subtle")}
              aria-live="polite"
            >
              {count} / {maxLength}
            </span>
            <button
              type="button"
              // mousedown/pointerdown で先にフォーカスが外れないようにする（タップが背後に抜けるのを防ぐ）
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => textareaRef.current?.blur()}
              className="flex min-h-11 items-center gap-1 rounded-full bg-primary px-4 text-sm font-bold text-on-primary"
              aria-label="入力を完了してキーボードを閉じる"
            >
              <Check size={18} aria-hidden />
              完了
            </button>
          </div>
        )}
        {focused && reference && (
          <div className="mb-2 max-h-20 shrink-0 overflow-y-auto rounded-xl bg-surface-muted px-3 py-2 text-sm text-ink-muted">
            {reference}
          </div>
        )}
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          onFocus={enter}
          onBlur={exit}
          maxLength={maxLength}
          rows={focused ? undefined : rows}
          placeholder={placeholder}
          {...(english ? { lang: "en", autoCapitalize: "sentences", spellCheck: false, autoCorrect: "off" } : {})}
          className={cn(
            "block w-full resize-none rounded-2xl border border-line bg-surface p-4 placeholder:text-ink-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring",
            // iOS の自動ズームを防ぐため 16px 以上
            english ? "english text-lg" : "text-base",
            focused && "min-h-0 flex-1 overflow-y-auto overscroll-contain",
            className,
          )}
        />
      </div>
    </>
  );
});
