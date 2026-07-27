import { useEffect, useRef, useState } from "react";
import { Link } from "../app";

type Direction = "right" | "left";
type GlyphKind =
  | "document"
  | "table"
  | "chart"
  | "message"
  | "network"
  | "wave";
type RGB = readonly [number, number, number];

type Settings = {
  density: number;
  speed: number;
  spread: number;
  glow: number;
  direction: Direction;
};

type RecordParticle = {
  progress: number;
  speed: number;
  x: number;
  lane: number;
  size: number;
  kind: GlyphKind;
  color: RGB;
  rotation: number;
  spin: number;
  phase: number;
};

type PortalParticle = {
  u: number;
  v: number;
  flow: number;
  swirl: number;
  size: number;
  color: RGB;
  twinkle: number;
};

type Ray = {
  progress: number;
  fromY: number;
  toY: number;
  depth: number;
  speed: number;
  width: number;
  color: RGB;
};

const GREEN: RGB = [82, 224, 139];
const BLUE: RGB = [72, 151, 255];
const VIOLET: RGB = [194, 103, 255];
const PALETTE = [GREEN, BLUE, VIOLET] as const;
const GLYPHS: GlyphKind[] = [
  "document",
  "table",
  "chart",
  "message",
  "network",
  "wave",
];

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;
const rgba = ([red, green, blue]: RGB, alpha: number) =>
  `rgba(${red}, ${green}, ${blue}, ${alpha})`;
const randomItem = <T,>(items: readonly T[]) =>
  items[Math.floor(Math.random() * items.length)] as T;

function createRecord(startAtRandomPoint = true): RecordParticle {
  return {
    progress: startAtRandomPoint ? Math.random() : 0,
    speed: 0.07 + Math.random() * 0.1,
    x: Math.random(),
    lane: (Math.random() * 2 - 1) * (0.35 + Math.random() * 0.65),
    size: 8 + Math.random() * 13,
    kind: randomItem(GLYPHS),
    color: Math.random() < 0.42 ? randomItem(PALETTE) : [230, 239, 234],
    rotation: (Math.random() * 2 - 1) * 0.5,
    spin: (Math.random() * 2 - 1) * 0.55,
    phase: Math.random() * Math.PI * 2,
  };
}

function createPortalParticle(): PortalParticle {
  return {
    u: Math.random() * Math.PI * 2,
    v: Math.random() * Math.PI * 2,
    flow: (0.05 + Math.random() * 0.13) * (Math.random() < 0.5 ? -1 : 1),
    swirl: (0.16 + Math.random() * 0.4) * (Math.random() < 0.5 ? -1 : 1),
    size: 0.55 + Math.random() * 1.2,
    color: Math.random() < 0.25 ? randomItem(PALETTE) : [193, 239, 209],
    twinkle: Math.random() * Math.PI * 2,
  };
}

function createRay(): Ray {
  const fromY = (Math.random() * 2 - 1) * 0.45;
  return {
    progress: 0,
    fromY,
    toY: fromY * (0.45 + Math.random() * 0.35) + (Math.random() * 2 - 1) * 0.25,
    depth: Math.random() * 2 - 1,
    speed: 0.14 + Math.random() * 0.24,
    width: 0.65 + Math.random() * 1.4,
    color: Math.random() < 0.2 ? randomItem(PALETTE) : [214, 244, 225],
  };
}

function drawGlyph(
  context: CanvasRenderingContext2D,
  particle: RecordParticle,
  x: number,
  y: number,
  scale: number,
  opacity: number,
) {
  context.save();
  context.translate(x, y);
  context.rotate(particle.rotation);
  context.scale(scale, scale);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 1.25;
  context.strokeStyle = rgba(particle.color, opacity);
  context.fillStyle = rgba(particle.color, opacity * 0.72);

  switch (particle.kind) {
    case "document":
      context.beginPath();
      context.roundRect(-6, -8, 12, 16, 2);
      context.stroke();
      for (let row = -1; row <= 1; row += 1) {
        context.beginPath();
        context.moveTo(-3.5, row * 4);
        context.lineTo(row === 1 ? 1.5 : 3.5, row * 4);
        context.stroke();
      }
      break;
    case "table":
      context.beginPath();
      context.roundRect(-8, -6, 16, 12, 2);
      context.stroke();
      context.beginPath();
      context.moveTo(-8, -1.5);
      context.lineTo(8, -1.5);
      context.moveTo(-8, 2.5);
      context.lineTo(8, 2.5);
      context.moveTo(-2, -6);
      context.lineTo(-2, 6);
      context.stroke();
      break;
    case "chart":
      context.beginPath();
      context.roundRect(-8, -7, 16, 14, 2);
      context.stroke();
      for (const [index, bar] of [-4, 0, 4].entries()) {
        context.beginPath();
        context.moveTo(bar, 4);
        context.lineTo(bar, [1, -4, -1][index] ?? 0);
        context.stroke();
      }
      break;
    case "message":
      context.beginPath();
      context.roundRect(-8, -6, 16, 10, 4);
      context.stroke();
      context.beginPath();
      context.moveTo(-2, 4);
      context.lineTo(0, 8);
      context.lineTo(3, 4);
      context.stroke();
      for (const dot of [-4, 0, 4]) {
        context.beginPath();
        context.arc(dot, -1, 0.9, 0, Math.PI * 2);
        context.fill();
      }
      break;
    case "network": {
      const nodes = [
        [-5, 4],
        [5, 4],
        [0, -5],
      ] as const;
      context.beginPath();
      context.moveTo(nodes[0][0], nodes[0][1]);
      context.lineTo(nodes[2][0], nodes[2][1]);
      context.lineTo(nodes[1][0], nodes[1][1]);
      context.lineTo(nodes[0][0], nodes[0][1]);
      context.stroke();
      for (const [nodeX, nodeY] of nodes) {
        context.beginPath();
        context.arc(nodeX, nodeY, 1.8, 0, Math.PI * 2);
        context.fill();
      }
      break;
    }
    case "wave":
      for (const [index, height] of [5, 10, 14, 8].entries()) {
        const lineX = -6.5 + index * 4.3;
        context.beginPath();
        context.moveTo(lineX, height / 2);
        context.lineTo(lineX, -height / 2);
        context.stroke();
      }
      break;
  }

  context.restore();
}

function TransformationCanvas({
  settings,
  paused,
  resetKey,
}: {
  settings: Settings;
  paused: boolean;
  resetKey: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  const pausedRef = useRef(paused);
  const wakeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
    pausedRef.current = paused;
    wakeRef.current?.();
  }, [paused, settings]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!container || !canvas || !context) return;
    canvas.dataset.generation = String(resetKey);

    let width = 1;
    let height = 1;
    let elapsed = 0;
    let lastTime = performance.now();
    let animationFrame = 0;
    let running = false;
    let reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const records = Array.from({ length: 180 }, () => createRecord());
    const portal = Array.from({ length: 1800 }, createPortalParticle);
    const rays = Array.from({ length: 180 }, createRay);

    const resize = () => {
      const bounds = container.getBoundingClientRect();
      width = Math.max(bounds.width, 1);
      height = Math.max(bounds.height, 1);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(0);
    };

    const spawnRays = (count: number) => {
      for (let index = 0; index < count; index += 1) {
        const expired = rays.find((ray) => ray.progress >= 1);
        const target = expired ?? rays[index % rays.length];
        if (!target) continue;
        Object.assign(target, createRay());
      }
    };

    const draw = (delta: number) => {
      const current = settingsRef.current;
      elapsed += delta * current.speed;
      context.clearRect(0, 0, width, height);
      context.save();

      if (current.direction === "left") {
        context.translate(width, 0);
        context.scale(-1, 1);
      }

      const centerY = height / 2;
      const portalX = width * (width < 700 ? 0.54 : 0.52);
      const radius = Math.min(height * 0.3, width * 0.11);
      const rayEndX = width * 0.98;
      const activeRecords = Math.round(45 + current.density * 90);
      const activePortal = Math.round(380 + current.density * 900);

      const ambient = context.createRadialGradient(
        portalX,
        centerY,
        0,
        portalX,
        centerY,
        radius * 2.4,
      );
      ambient.addColorStop(0, rgba(GREEN, 0.16 * current.glow));
      ambient.addColorStop(0.48, rgba(GREEN, 0.045 * current.glow));
      ambient.addColorStop(1, rgba(GREEN, 0));
      context.fillStyle = ambient;
      context.beginPath();
      context.arc(portalX, centerY, radius * 2.4, 0, Math.PI * 2);
      context.fill();

      const beam = context.createLinearGradient(
        portalX,
        centerY,
        rayEndX,
        centerY,
      );
      beam.addColorStop(0, rgba(GREEN, 0.11 * current.glow));
      beam.addColorStop(0.5, "rgba(186, 236, 205, 0.035)");
      beam.addColorStop(1, "rgba(186, 236, 205, 0)");
      context.fillStyle = beam;
      context.beginPath();
      context.moveTo(portalX, centerY - radius * 0.55);
      context.lineTo(rayEndX, centerY - height * 0.32 * current.spread);
      context.lineTo(rayEndX, centerY + height * 0.32 * current.spread);
      context.lineTo(portalX, centerY + radius * 0.55);
      context.closePath();
      context.fill();

      for (const particle of records.slice(0, activeRecords)) {
        particle.progress += particle.speed * delta * current.speed;
        particle.rotation += particle.spin * delta * 0.35 * current.speed;
        if (particle.progress >= 1) {
          spawnRays(Math.max(1, Math.round(current.density * 1.5)));
          Object.assign(particle, createRecord(false));
        }

        const startX =
          width * 0.035 +
          particle.x * Math.max(portalX - radius * 2.25, width * 0.14) * 0.72;
        const endX = portalX - radius * 0.1;
        const collapse = (1 - particle.progress) ** 1.18;
        const particleX = lerp(startX, endX, particle.progress);
        const particleY =
          centerY +
          particle.lane * height * 0.42 * collapse * current.spread +
          Math.sin(particle.phase + particle.progress * 5) * 7 * collapse;
        const fade = clamp(
          Math.min(particle.progress / 0.07, (1 - particle.progress) / 0.06),
          0,
          1,
        );
        const scale =
          (particle.size / 12) *
          (1 - particle.progress * 0.52) *
          clamp(width / 1100, 0.58, 1);
        drawGlyph(context, particle, particleX, particleY, scale, fade * 0.7);
      }

      context.save();
      context.globalCompositeOperation = "lighter";
      for (const particle of portal.slice(0, activePortal)) {
        const u = particle.u + elapsed * particle.flow;
        const v = particle.v + elapsed * particle.swirl;
        const tube = radius * 0.17;
        const majorRadius = radius + Math.cos(v) * tube;
        const depth = Math.cos(u);
        const particleX =
          portalX + Math.sin(v) * tube * 0.82 + depth * radius * 0.075;
        const particleY = centerY + Math.sin(u) * majorRadius;
        const depthLight = clamp((depth + 1.25) / 2.25, 0.22, 1);
        const twinkle = 0.78 + Math.sin(elapsed * 2 + particle.twinkle) * 0.22;
        const opacity =
          (0.08 + depthLight * 0.48) * twinkle * (0.65 + current.glow * 0.35);
        context.fillStyle = rgba(particle.color, opacity);
        context.beginPath();
        context.arc(
          particleX,
          particleY,
          particle.size * (0.55 + depthLight * 0.8),
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      context.restore();

      context.save();
      context.globalCompositeOperation = "lighter";
      context.lineCap = "round";
      for (const ray of rays) {
        if (ray.progress >= 1) continue;
        ray.progress += ray.speed * delta * current.speed;
        const head = ray.progress;
        const tail = Math.max(0, head - 0.035 - ray.speed * 0.045);
        const originX = portalX + radius * 0.12;
        const originY = centerY + ray.fromY * radius * 0.42;
        const targetY =
          centerY +
          ray.toY * height * 0.36 * current.spread -
          ray.depth * height * 0.025;
        const alpha =
          clamp(head / 0.035, 0, 1) *
          (1 - head) ** 1.5 *
          (0.44 + current.glow * 0.32);
        context.strokeStyle = rgba(ray.color, alpha);
        context.lineWidth = ray.width * (1 - head * 0.45);
        context.beginPath();
        context.moveTo(
          lerp(originX, rayEndX, tail),
          lerp(originY, targetY, tail),
        );
        context.lineTo(
          lerp(originX, rayEndX, head),
          lerp(originY, targetY, head),
        );
        context.stroke();
      }
      context.restore();
      context.restore();
    };

    const tick = (now: number) => {
      if (pausedRef.current || reducedMotion) {
        running = false;
        draw(0);
        return;
      }
      const delta = clamp((now - lastTime) / 1000, 0, 0.05);
      lastTime = now;
      draw(delta);
      animationFrame = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (pausedRef.current || reducedMotion) {
        cancelAnimationFrame(animationFrame);
        running = false;
        draw(0);
        return;
      }
      if (!running) {
        running = true;
        lastTime = performance.now();
        animationFrame = requestAnimationFrame(tick);
      }
    };

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionPreference = () => {
      reducedMotion = motionQuery.matches;
      wake();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    motionQuery.addEventListener("change", handleMotionPreference);
    wakeRef.current = wake;
    resize();
    wake();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      motionQuery.removeEventListener("change", handleMotionPreference);
      wakeRef.current = null;
    };
  }, [resetKey]);

  return (
    <div ref={containerRef} className="transformation-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="transformation-canvas"
        role="img"
        aria-label="Animated records converging into a particle portal and emerging as ordered rays"
      />
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="transformation-range">
      <span>
        {label}
        <output>
          {value.toFixed(step < 0.1 ? 2 : 1)}
          {unit}
        </output>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

export function TransformationDemo() {
  const [settings, setSettings] = useState<Settings>({
    density: 0.9,
    speed: 1,
    spread: 1,
    glow: 1,
    direction: "right",
  });
  const [paused, setPaused] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const updateSetting = <Key extends keyof Settings>(
    key: Key,
    value: Settings[Key],
  ) => setSettings((current) => ({ ...current, [key]: value }));

  return (
    <div className="transformation-demo">
      <div className="transformation-grid" aria-hidden="true" />
      <header className="transformation-header">
        <Link href="/" className="transformation-back">
          <span aria-hidden="true">←</span> vibegui
        </Link>
        <div className="transformation-status">
          <span aria-hidden="true" />
          Canvas 2D · live
        </div>
      </header>

      <section className="transformation-stage" aria-labelledby="demo-title">
        <div className="transformation-copy">
          <p>Transformation lab</p>
          <h1 id="demo-title">From scattered records to useful context.</h1>
          <span>
            A small generative canvas study. Tune the system and watch disorder
            converge into a queryable stream.
          </span>
        </div>

        <TransformationCanvas
          settings={settings}
          paused={paused}
          resetKey={resetKey}
        />

        <aside className="transformation-controls" aria-label="Demo controls">
          <div className="transformation-controls-heading">
            <div>
              <h2>Controls</h2>
              <p>Adjust the simulation in real time.</p>
            </div>
            <button
              type="button"
              onClick={() => setPaused((current) => !current)}
              aria-pressed={paused}
            >
              {paused ? "Play" : "Pause"}
            </button>
          </div>

          <div className="transformation-control-list">
            <RangeControl
              label="Density"
              value={settings.density}
              min={0.25}
              max={1.5}
              step={0.05}
              onChange={(value) => updateSetting("density", value)}
            />
            <RangeControl
              label="Speed"
              value={settings.speed}
              min={0.2}
              max={2}
              step={0.05}
              unit="×"
              onChange={(value) => updateSetting("speed", value)}
            />
            <RangeControl
              label="Spread"
              value={settings.spread}
              min={0.4}
              max={1.45}
              step={0.05}
              onChange={(value) => updateSetting("spread", value)}
            />
            <RangeControl
              label="Glow"
              value={settings.glow}
              min={0}
              max={1.6}
              step={0.05}
              onChange={(value) => updateSetting("glow", value)}
            />
          </div>

          <fieldset className="transformation-direction">
            <legend>Flow direction</legend>
            <div>
              {(["right", "left"] as const).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  aria-pressed={settings.direction === direction}
                  onClick={() => updateSetting("direction", direction)}
                >
                  {direction === "right" ? "Records → rays" : "Rays ← records"}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            className="transformation-reset"
            onClick={() => setResetKey((current) => current + 1)}
          >
            Regenerate particles
          </button>
        </aside>
      </section>

      <footer className="transformation-credit">
        Inspired by the homepage visualization at{" "}
        <a href="https://polygres.com/" target="_blank" rel="noreferrer">
          Polygres ↗
        </a>
        . Recreated independently as a Canvas 2D study.
      </footer>
    </div>
  );
}
