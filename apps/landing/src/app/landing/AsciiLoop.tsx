"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Ambient ASCII "flowing loop" rendered behind the hero wordmark.
 *
 * A closed rounded-rectangle track is traced once into an ordered list of grid
 * cells. Each frame a bright "comet" (head + fading tail) advances along that
 * track, so glyphs appear to flow continuously around the loop — a nod to the
 * product's discover → keep → generate → reinforce cycle.
 *
 * Decorative only (aria-hidden). Honors prefers-reduced-motion (static frame,
 * no rAF) and pauses while the tab is hidden to avoid background CPU.
 */

const COLS = 64;
const ROWS = 20;
const MARGIN_X = 6;
const MARGIN_Y = 3;

const TRACK_GLYPHS = "·-·|"; // faint static track texture
const COMET = ["=", "+", "*", "@", "*", "+", "="]; // head is centre, tails fade out
const COMET_HEAD = Math.floor(COMET.length / 2);
/** Cells advanced per second. Calm, not jarring. */
const SPEED = 14;

type Cell = { row: number; col: number };

/** Trace a closed rounded-rectangle path into an ordered, de-duplicated cell list. */
function buildTrack(): Cell[] {
  const left = MARGIN_X;
  const right = COLS - 1 - MARGIN_X;
  const top = MARGIN_Y;
  const bottom = ROWS - 1 - MARGIN_Y;
  const cells: Cell[] = [];
  const push = (col: number, row: number) => {
    const last = cells[cells.length - 1];
    if (last && last.col === col && last.row === row) return;
    cells.push({ row, col });
  };

  // top edge → right edge → bottom edge → left edge, clockwise
  for (let c = left; c <= right; c++) push(c, top);
  for (let r = top; r <= bottom; r++) push(right, r);
  for (let c = right; c >= left; c--) push(c, bottom);
  for (let r = bottom; r >= top; r--) push(left, r);

  return cells;
}

/** Render the grid to a string for a given comet head position along the track. */
function renderFrame(track: Cell[], head: number): string {
  const grid: string[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => " "),
  );

  // faint static track
  track.forEach((cell, i) => {
    grid[cell.row][cell.col] = TRACK_GLYPHS[i % TRACK_GLYPHS.length];
  });

  // bright comet overlaid on top
  const len = track.length;
  for (let i = 0; i < COMET.length; i++) {
    const idx = (((head + i - COMET_HEAD) % len) + len) % len;
    const cell = track[idx];
    grid[cell.row][cell.col] = COMET[i];
  }

  return grid.map((row) => row.join("")).join("\n");
}

export function AsciiLoop({ className }: { className?: string }) {
  const track = useMemo(() => buildTrack(), []);
  const [frame, setFrame] = useState(() => renderFrame(track, 0));

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // initial state already renders frame 0; skip the rAF loop entirely.
    if (reduceMotion) return;

    let raf = 0;
    let last = performance.now();
    let progress = 0;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      progress = (progress + dt * SPEED) % track.length;
      setFrame(renderFrame(track, Math.floor(progress)));
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => cancelAnimationFrame(raf);

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [track]);

  return (
    <pre
      aria-hidden="true"
      className={`pointer-events-none select-none whitespace-pre font-mono leading-none tracking-tight ${className ?? ""}`}
    >
      {frame.split("\n").map((line, r) => (
        <span key={r} className="block text-ink/7 dark:text-ink/6">
          {line.split("").map((ch, c) =>
            COMET.includes(ch) ? (
              <span key={c} className="text-accent/30">
                {ch}
              </span>
            ) : (
              ch
            ),
          )}
        </span>
      ))}
    </pre>
  );
}
