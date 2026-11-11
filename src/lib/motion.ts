"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/** Mirrors `--dur-slow` in globals.css (JS-driven motion needs the number). */
export const DUR_SLOW_MS = 400;

/** Stagger for `animate-reveal` rows: 30ms apart, capped so a long list
 *  does not keep arriving for a second. */
export function stagger(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index, 8) * 30}ms` };
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/**
 * The number on screen, easing to `target` whenever it changes. The first
 * value is shown as is — only a change is animated.
 */
export function useAnimatedNumber(target: number | null): number | null {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const from = shownRef.current;
    // A hidden tab gets no animation frames — show the value at once
    // rather than leave a stale number on screen until it is visible.
    const hidden = document.visibilityState !== "visible";
    if (target === null || from === null || reduced || hidden || from === target) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DUR_SLOW_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (target - from) * eased;
      shownRef.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Correctness never depends on animation frames (a throttled or
    // occluded window gets none): land on the target regardless.
    const settle = window.setTimeout(() => {
      cancelAnimationFrame(frame);
      shownRef.current = target;
      setShown(target);
    }, DUR_SLOW_MS + 100);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [target, reduced]);

  return shown;
}
