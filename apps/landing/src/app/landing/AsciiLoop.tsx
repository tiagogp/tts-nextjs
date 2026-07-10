"use client";

import { useEffect, useState } from "react";

/** A Claude Code-style braille spinner, decorative behind the hero wordmark. */

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
/** Matches the cadence of Claude Code's CLI spinner. */
const FPS = 12;

export function AsciiLoop({ className }: { className?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let animationFrame = 0;
    let previous = performance.now();
    let elapsed = 0;

    const tick = (now: number) => {
      elapsed += now - previous;
      previous = now;
      if (elapsed >= 1000 / FPS) {
        elapsed = 0;
        setFrame((current) => (current + 1) % FRAMES.length);
      }
      animationFrame = requestAnimationFrame(tick);
    };
    const start = () => {
      previous = performance.now();
      animationFrame = requestAnimationFrame(tick);
    };
    const stop = () => cancelAnimationFrame(animationFrame);
    const onVisibilityChange = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const glyph = FRAMES[frame];

  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none relative inline-block select-none font-mono leading-none text-accent/70 ${className ?? ""}`}
    >
      <span aria-hidden="true" className="absolute inset-0 text-accent/40 blur-md">
        {glyph}
      </span>
      <span className="relative">{glyph}</span>
    </span>
  );
}
