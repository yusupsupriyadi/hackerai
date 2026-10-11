"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import { hash } from "./hash";

type PixelFieldVariant = "fade-down" | "fade-up" | "blobs" | "band";

interface PixelFieldProps {
  variant: PixelFieldVariant;
  seed: number;
  /** Size of one dither cell in CSS pixels. */
  cell?: number;
  /** Radius in CSS pixels of a tall clearing at the center, kept free for a focal element. */
  clearRadius?: number;
  className?: string;
}

interface PaintState {
  variant: PixelFieldVariant;
  seed: number;
  cell: number;
  clearCells: number;
  /** 0 while the field glitches in, 1 once it has resolved. */
  progress: number;
  /** Seconds of drift. */
  time: number;
  /** Milliseconds since the field started, for glitch timing. */
  elapsed: number;
  pointer: { x: number; y: number } | null;
}

const BAYER_4X4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (value) => (value + 0.5) / 16,
);
const PIXEL_ALPHA: Record<PixelFieldVariant, number> = {
  "fade-down": 235,
  "fade-up": 235,
  blobs: 150,
  band: 190,
};
// ~15fps: stepped motion reads as retro and keeps the per-frame cost low.
const FRAME_MS = 66;
const RESOLVE_MS = 540;
const BURST_EVERY_MS = 3200;
const BURST_MS = 320;
const GLITCH_STEP_MS = 60;
const POINTER_RADIUS = 72;

function valueNoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Two octaves drifting at different speeds, so the clouds move and change shape.
function clouds(x: number, y: number, seed: number, time: number) {
  return (
    valueNoise(x + time * 0.12, y, seed) * 0.65 +
    valueNoise(x * 2.1 - time * 0.3, y * 2.1 + time * 0.06, seed + 1) * 0.35
  );
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function intensity(
  { variant, seed, time }: PaintState,
  col: number,
  row: number,
  rows: number,
) {
  if (variant === "blobs") {
    // A sparse dot floor plus large halftone masses, like a dithered desktop.
    return (
      0.04 + smoothstep(0.5, 0.82, clouds(col / 30, row / 30, seed, time)) * 0.9
    );
  }
  if (variant === "band") {
    return (
      0.05 + smoothstep(0.35, 0.8, clouds(col / 14, row / 6, seed, time)) * 0.8
    );
  }
  const depth = variant === "fade-down" ? 1 - row / rows : row / rows;
  const cloud = smoothstep(0.3, 0.72, clouds(col / 34, row / 15, seed, time));
  return depth ** 1.4 * (0.08 + 0.92 * cloud);
}

// Horizontal slices displaced sideways, echoing the offset rows in the logo.
function glitchShift(row: number, rows: number, state: PaintState) {
  const { seed, elapsed, progress } = state;
  let shift = 0;
  for (let band = 0; band < 6; band++) {
    const start = Math.floor(hash(band, 0, seed) * rows);
    const height = 1 + Math.floor(hash(band, 1, seed) * 4);
    if (row >= start && row < start + height) {
      shift += Math.round((hash(band, 2, seed) - 0.5) * 48);
    }
  }

  const tick = Math.floor(elapsed / GLITCH_STEP_MS);
  // Intro: rows jitter hard, settling as the field resolves.
  const jitter = 1 - progress;
  if (jitter > 0 && hash(row, tick, seed + 7) < jitter * 0.6) {
    shift += Math.round((hash(tick, row, seed + 3) - 0.5) * 30 * jitter);
  }
  // A short burst every few seconds, at a seeded offset per field.
  const cycle = Math.floor(elapsed / BURST_EVERY_MS);
  const burstAt =
    cycle * BURST_EVERY_MS + hash(cycle, 0, seed) * (BURST_EVERY_MS - BURST_MS);
  if (progress === 1 && elapsed >= burstAt && elapsed < burstAt + BURST_MS) {
    const slice = Math.floor(row / 3);
    if (hash(slice, tick, seed + 13) < 0.3) {
      shift += Math.round((hash(slice, tick, seed + 17) - 0.5) * 40);
    }
  }
  return shift;
}

function paint(
  data: Uint8ClampedArray,
  cols: number,
  rows: number,
  state: PaintState,
) {
  const { cell, clearCells, pointer, progress, seed, elapsed } = state;
  const alpha = PIXEL_ALPHA[state.variant];
  const tick = Math.floor(elapsed / GLITCH_STEP_MS);
  data.fill(0);
  for (let row = 0; row < rows; row++) {
    let shift = glitchShift(row, rows, state);
    const rowY = (row + 0.5) * cell;
    const nearPointer =
      pointer !== null && Math.abs(rowY - pointer.y) < POINTER_RADIUS * 0.6;
    if (nearPointer) {
      shift += Math.round((hash(row, tick, seed + 21) - 0.5) * 4);
    }
    for (let col = 0; col < cols; col++) {
      let level =
        intensity(state, col - shift, row, rows) * (0.4 + 0.6 * progress);
      if (clearCells > 0) {
        const distance = Math.hypot(col - cols / 2, (row - rows * 0.52) * 0.55);
        level *= smoothstep(clearCells, clearCells * 1.9, distance);
      }
      if (nearPointer && pointer) {
        // The pointer digs a hole through the cloud.
        const distance = Math.hypot(
          (col + 0.5) * cell - pointer.x,
          rowY - pointer.y,
        );
        level *= smoothstep(POINTER_RADIUS * 0.35, POINTER_RADIUS, distance);
      }
      if (level > BAYER_4X4[(row % 4) * 4 + (col % 4)]) {
        const index = (row * cols + col) * 4;
        data[index] = 255;
        data[index + 1] = 255;
        data[index + 2] = 255;
        data[index + 3] = alpha;
      }
    }
  }
}

/**
 * Decorative ordered-dither field of white pixels. It glitches in when it
 * first scrolls into view, then drifts, bursts now and then, and clears
 * around the pointer. It animates only while visible, and renders still when
 * the visitor prefers reduced motion.
 */
export function PixelField({
  variant,
  seed,
  cell = 6,
  clearRadius = 0,
  className,
}: PixelFieldProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!wrapper || !canvas || !context) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let image: ImageData | null = null;
    let animationFrame = 0;
    let startedAt = -1;
    let lastFrameAt = 0;
    let elapsed = 0;
    let pointer: PaintState["pointer"] = null;

    const draw = () => {
      const cols = Math.ceil(wrapper.clientWidth / cell);
      const rows = Math.ceil(wrapper.clientHeight / cell);
      if (cols === 0 || rows === 0) return;
      if (!image || image.width !== cols || image.height !== rows) {
        canvas.width = cols;
        canvas.height = rows;
        canvas.style.width = `${cols * cell}px`;
        canvas.style.height = `${rows * cell}px`;
        image = context.createImageData(cols, rows);
      }
      paint(image.data, cols, rows, {
        variant,
        seed,
        cell,
        clearCells: clearRadius / cell,
        progress: reduceMotion ? 1 : Math.min(1, elapsed / RESOLVE_MS),
        time: reduceMotion ? 0 : elapsed / 1000,
        elapsed: reduceMotion ? 0 : elapsed,
        pointer: reduceMotion ? null : pointer,
      });
      context.putImageData(image, 0, 0);
    };

    const loop = (now: number) => {
      animationFrame = requestAnimationFrame(loop);
      if (now - lastFrameAt < FRAME_MS) return;
      lastFrameAt = now;
      if (startedAt < 0) startedAt = now;
      elapsed = now - startedAt;
      draw();
    };

    const visibility = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      cancelAnimationFrame(animationFrame);
      if (!visible) return;
      if (reduceMotion) {
        draw();
      } else {
        animationFrame = requestAnimationFrame(loop);
      }
    });
    const resize = new ResizeObserver(() => {
      if (startedAt >= 0 || reduceMotion) draw();
    });
    const onPointerMove = (event: PointerEvent) => {
      const rect = wrapper.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const inside =
        x > -POINTER_RADIUS &&
        y > -POINTER_RADIUS &&
        x < rect.width + POINTER_RADIUS &&
        y < rect.height + POINTER_RADIUS;
      pointer = inside ? { x, y } : null;
    };
    const onPointerLeave = () => {
      pointer = null;
    };

    visibility.observe(wrapper);
    resize.observe(wrapper);
    if (!reduceMotion) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerLeave);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      visibility.disconnect();
      resize.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener(
        "pointerleave",
        onPointerLeave,
      );
    };
  }, [variant, seed, cell, clearRadius]);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className={cn("pointer-events-none relative overflow-hidden", className)}
    >
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 [image-rendering:pixelated]"
      />
    </div>
  );
}
