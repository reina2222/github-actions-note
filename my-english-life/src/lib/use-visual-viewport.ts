"use client";

/**
 * 実際に見えている領域（Visual Viewport）の高さと位置。
 *
 * iPhone Safari ではキーボードが出ても 100vh / window.innerHeight は変わらず、
 * レイアウト全体が上にずれる。visualViewport の height と offsetTop を使えば
 * 「キーボードの上に見えている範囲」にぴったり合わせられる。
 */
import { useEffect, useState } from "react";

export type ViewportBox = { height: number; offsetTop: number };

export function readViewport(): ViewportBox {
  if (typeof window === "undefined") return { height: 0, offsetTop: 0 };
  const vv = window.visualViewport;
  if (vv) return { height: Math.round(vv.height), offsetTop: Math.round(vv.offsetTop) };
  return { height: window.innerHeight, offsetTop: 0 };
}

/** enabled の間だけ購読する（普段は余計な再描画をしない） */
export function useVisualViewport(enabled: boolean): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null);

  useEffect(() => {
    if (!enabled) {
      setBox(null);
      return;
    }
    const vv = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readViewport();
        setBox((prev) => (prev && prev.height === next.height && prev.offsetTop === next.offsetTop ? prev : next));
      });
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [enabled]);

  return box;
}
