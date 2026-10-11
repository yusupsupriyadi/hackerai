"use client";

import { useEffect, useRef, useState } from "react";
import type * as Three from "three";

import { HackerAISVG } from "@/components/icons/hackerai-svg";
import { cn } from "@/lib/utils";

import { hash } from "@/components/public/retro/hash";

// Voxel rows the mark is resampled to: coarse enough that each cube reads as a pixel.
const TARGET_ROWS = 60;
const ASSEMBLE_MS = 1400;
const ASSEMBLE_SPAN = 0.55;
const GLITCH_MS = 420;
const GLITCH_STEP_MS = 60;
const SWAY_PERIOD_MS = 1600;
const REST_ROTATION = { x: 0.1, y: -0.32 };

interface MarkGrid {
  cols: number;
  rows: number;
  cells: Array<readonly [number, number]>;
}

interface Voxel {
  x: number;
  y: number;
  band: number;
  delay: number;
  scatterX: number;
  scatterZ: number;
  flyX: number;
  flyY: number;
  flyZ: number;
  spin: number;
}

/**
 * Resamples the rendered logo SVG onto a coarse grid, so the 3D mark always
 * matches the current logo. A cell is filled when at least half of it is.
 */
function rasterizeMark(svg: SVGSVGElement): MarkGrid | null {
  const path = svg.querySelector("path");
  const d = path?.getAttribute("d");
  const viewBox = svg.viewBox.baseVal;
  if (!path || !d || !viewBox?.width || !viewBox.height) return null;

  const block = Math.max(1, Math.round(viewBox.height / TARGET_ROWS));
  const cols = Math.ceil(viewBox.width / block);
  const rows = Math.ceil(viewBox.height / block);
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.scale(1 / block, 1 / block);
  context.translate(-viewBox.x, -viewBox.y);
  context.fill(
    new Path2D(d),
    path.getAttribute("fill-rule") === "evenodd" ? "evenodd" : "nonzero",
  );

  const { data } = context.getImageData(0, 0, cols, rows);
  const cells: MarkGrid["cells"] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (data[(row * cols + col) * 4 + 3] >= 128) cells.push([col, row]);
    }
  }
  return cells.length > 0 ? { cols, rows, cells } : null;
}

function buildVoxels({ cols, rows, cells }: MarkGrid) {
  // Rows glitch together in bands, like slices of a broken scanline.
  const bandHeight = Math.max(2, Math.round(rows / 20));
  return cells.map(([col, row], index): Voxel => {
    const band = Math.floor(row / bandHeight);
    return {
      x: col - (cols - 1) / 2,
      y: (rows - 1) / 2 - row,
      band,
      delay: (row / rows) * 0.45 + hash(index, 4, 5) * 0.15,
      scatterX:
        (hash(band, 1, 5) - 0.5) * cols * 2 + (hash(index, 2, 5) - 0.5) * 6,
      scatterZ: (hash(index, 3, 5) - 0.5) * 36,
      flyX: (hash(band, 5, 5) - 0.5) * cols * 2.2,
      flyY: hash(index, 6, 5) * rows * 0.5 + 6,
      flyZ: (hash(index, 7, 5) - 0.3) * 50,
      spin: (hash(index, 8, 5) - 0.5) * 6,
    };
  });
}

/** Builds the voxel scene in `container` and returns its teardown. */
function mountScene(
  THREE: typeof Three,
  container: HTMLElement,
  mark: MarkGrid,
  onFirstFrame: () => void,
) {
  let renderer: Three.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
  } catch {
    // No WebGL: the flat mark stays visible.
    return () => {};
  }

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "absolute inset-0 size-full";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 600);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
  keyLight.position.set(-20, 30, 40);
  scene.add(keyLight);

  const voxels = buildVoxels(mark);
  const geometry = new THREE.BoxGeometry(0.9, 0.9, 3);
  const material = new THREE.MeshStandardMaterial({
    color: 0xf2f2f2,
    roughness: 0.6,
    metalness: 0,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, voxels.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const group = new THREE.Group();
  group.add(mesh);
  scene.add(group);

  const dummy = new THREE.Object3D();
  const rotation = { ...REST_ROTATION };
  const target = { ...REST_ROTATION };
  let startedAt = -1;
  let glitchUntil = 0;
  let explode = 0;
  let dirty = true;
  let firstFrame = true;

  const layout = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const span = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fitHeight = (mark.rows * 1.2) / span;
    const fitWidth = (mark.cols * 1.6) / (span * camera.aspect);
    camera.position.set(0, 0, Math.max(fitHeight, fitWidth));
    camera.updateProjectionMatrix();
    dirty = true;
  };

  const placeVoxels = (now: number) => {
    const elapsed = now - startedAt;
    const glitchTick =
      now < glitchUntil ? Math.floor(now / GLITCH_STEP_MS) : -1;
    const blast = explode ** 3;
    voxels.forEach((voxel, index) => {
      const local = reduceMotion
        ? 1
        : Math.min(
            1,
            Math.max(0, (elapsed / ASSEMBLE_MS - voxel.delay) / ASSEMBLE_SPAN),
          );
      const remaining = (1 - local) ** 3;
      let x = voxel.x + voxel.scatterX * remaining;
      let y = voxel.y;
      let z = voxel.scatterZ * remaining;
      let scale = 1;
      if (glitchTick >= 0) {
        if (hash(voxel.band, glitchTick, 9) < 0.35) {
          x += (hash(voxel.band, glitchTick, 10) - 0.5) * 16;
          z += (hash(voxel.band, glitchTick, 11) - 0.5) * 10;
        }
        if (hash(index, glitchTick, 12) < 0.05) scale = 0;
      }
      x += voxel.flyX * blast;
      y += voxel.flyY * blast;
      z += voxel.flyZ * blast;
      dummy.position.set(x, y, z);
      dummy.rotation.set(voxel.spin * blast, voxel.spin * 0.6 * blast, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  const frame = (now: number) => {
    // The assembly starts on the first visible frame, not at mount.
    if (startedAt < 0) startedAt = now;
    if (reduceMotion && !dirty) return;
    rotation.x += (target.x - rotation.x) * 0.08;
    rotation.y += (target.y - rotation.y) * 0.08;
    // A slow sway keeps the depth readable where there is no pointer to follow.
    const sway = reduceMotion
      ? 0
      : Math.sin((now - startedAt) / SWAY_PERIOD_MS) * 0.28;
    placeVoxels(now);
    group.rotation.set(rotation.x, rotation.y + sway, 0);
    renderer.render(scene, camera);
    dirty = false;
    if (firstFrame) {
      firstFrame = false;
      onFirstFrame();
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    target.x =
      REST_ROTATION.x + (event.clientY / window.innerHeight - 0.5) * 0.4;
    target.y =
      REST_ROTATION.y + (event.clientX / window.innerWidth - 0.5) * 0.8;
  };
  const glitch = () => {
    glitchUntil = performance.now() + GLITCH_MS;
  };
  const onScroll = () => {
    const rect = container.getBoundingClientRect();
    explode = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.8)));
  };

  // Render only while the mark is on screen.
  const visibility = new IntersectionObserver((entries) => {
    const visible = entries.some((entry) => entry.isIntersecting);
    renderer.setAnimationLoop(visible ? frame : null);
  });
  const resize = new ResizeObserver(layout);
  layout();
  visibility.observe(container);
  resize.observe(container);
  if (!reduceMotion) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    container.addEventListener("pointerenter", glitch);
    container.addEventListener("pointerdown", glitch);
    onScroll();
  }

  return () => {
    renderer.setAnimationLoop(null);
    visibility.disconnect();
    resize.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("scroll", onScroll);
    container.removeEventListener("pointerenter", glitch);
    container.removeEventListener("pointerdown", glitch);
    mesh.dispose();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    canvas.remove();
  };
}

/**
 * The DiggerAI logo rebuilt from voxels. It assembles out of displaced slices,
 * glitches on hover or tap, follows the pointer, and breaks apart as the hero
 * scrolls away. Reduced motion renders it still; without WebGL the flat SVG
 * logo stays in place.
 */
export function GlitchMark({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const svg = container?.querySelector("svg");
    const mark = svg ? rasterizeMark(svg) : null;
    if (!container || !mark) return;
    let cancelled = false;
    let teardown: (() => void) | undefined;
    import("three")
      .then((THREE) => {
        if (cancelled) return;
        teardown = mountScene(THREE, container, mark, () => setRendered(true));
      })
      .catch(() => {
        // The flat logo stays as the fallback when the chunk fails to load.
      });
    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn("relative", className)}
    >
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity duration-300 [&>svg]:h-[80%] [&>svg]:w-auto",
          rendered && "opacity-0",
        )}
      >
        <HackerAISVG theme="dark" />
      </div>
    </div>
  );
}
