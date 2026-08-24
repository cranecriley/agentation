// =============================================================================
// Token Re-roll
// =============================================================================
//
// Live design exploration: reads the design-token custom properties declared
// on :root, applies a random-but-coherent "recipe" (hue rotation, saturation,
// lightness, radius scale) as inline overrides on the root element, and lets
// the user re-roll, copy the recipe, or reset. Nothing is persisted — reload
// clears everything.
//
// =============================================================================

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./styles.module.scss";

export type RerollConfig = {
  /** Custom-property prefixes treated as colors. Default: ["--color-"] */
  colorPrefixes?: string[];
  /** Custom-property prefixes treated as radii. Default: ["--radius-"] */
  radiusPrefixes?: string[];
};

export type RerollRecipe = {
  /** Degrees added to every chromatic token's hue. */
  hueShift: number;
  /** Multiplier on saturation (chromatic tokens only). */
  satMult: number;
  /** Percentage points added to lightness (chromatic tokens only). */
  lightShift: number;
  /** Multiplier applied to radius tokens. */
  radiusMult: number;
};

// ── Color math ───────────────────────────────────────────────────────────────

export type Hsla = { h: number; s: number; l: number; a: number };

/** Parse #rgb/#rgba/#rrggbb/#rrggbbaa or rgb()/rgba() into HSLA. */
export function parseSimpleColor(value: string): Hsla | null {
  const v = value.trim();
  let r: number, g: number, b: number, a = 1;
  const hex = v.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex && [3, 4, 6, 8].includes(hex.length)) {
    const long = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
    r = parseInt(long.slice(0, 2), 16);
    g = parseInt(long.slice(2, 4), 16);
    b = parseInt(long.slice(4, 6), 16);
    if (long.length === 8) a = parseInt(long.slice(6, 8), 16) / 255;
  } else {
    const m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i);
    if (!m) return null;
    r = Number(m[1]); g = Number(m[2]); b = Number(m[3]);
    if (m[4] != null) a = m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: (h + 360) % 360, s: s * 100, l: l * 100, a };
}

let canvasCtx: CanvasRenderingContext2D | null | undefined;

/**
 * Parse any CSS color (lab(), oklch(), named, …) by letting the browser
 * serialize it through a canvas fillStyle. Falls back to the simple parser
 * where canvas is unavailable (e.g. tests).
 */
export function parseColor(value: string): Hsla | null {
  const simple = parseSimpleColor(value);
  if (simple) return simple;
  if (typeof document === "undefined") return null;
  if (canvasCtx === undefined) {
    canvasCtx = document.createElement("canvas").getContext("2d");
  }
  if (!canvasCtx) return null;
  try {
    canvasCtx.fillStyle = "#000";
    canvasCtx.fillStyle = value;
    const serialized = canvasCtx.fillStyle; // "#rrggbb" or "rgba(...)"
    if (serialized === "#000000" && !/^(#0+|black|rgba?\(\s*0)/i.test(value.trim()) && value.trim() !== "#000") {
      // Assignment was rejected (fillStyle unchanged) — unparseable value.
      return null;
    }
    return parseSimpleColor(serialized);
  } catch {
    return null;
  }
}

export function applyRecipeToColor(c: Hsla, recipe: RerollRecipe): Hsla | null {
  // Leave near-achromatic tokens (backgrounds, text, borders) alone so
  // contrast and "neutral feel" survive every roll.
  if (c.s < 10) return null;
  return {
    h: (c.h + recipe.hueShift + 360) % 360,
    s: Math.min(100, Math.max(0, c.s * recipe.satMult)),
    l: Math.min(96, Math.max(4, c.l + recipe.lightShift)),
    a: c.a,
  };
}

export function hslaToCss(c: Hsla): string {
  const base = `${Math.round(c.h)} ${c.s.toFixed(1)}% ${c.l.toFixed(1)}%`;
  return c.a >= 1 ? `hsl(${base})` : `hsl(${base} / ${c.a.toFixed(3)})`;
}

// ── Token discovery ──────────────────────────────────────────────────────────

/** Collect :root custom properties from same-origin stylesheets. */
export function collectRootTokens(): Map<string, string> {
  const tokens = new Map<string, string>();
  if (typeof document === "undefined") return tokens;
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    const walk = (list: CSSRuleList) => {
      for (const rule of Array.from(list)) {
        const style = (rule as CSSStyleRule).style;
        const selector = (rule as CSSStyleRule).selectorText || "";
        if (style && selector.split(",").some((s) => s.trim() === ":root")) {
          for (const name of Array.from(style)) {
            if (name.startsWith("--")) {
              tokens.set(name, style.getPropertyValue(name).trim());
            }
          }
        }
        const children = (rule as CSSGroupingRule).cssRules;
        if (children) walk(children);
      }
    };
    walk(rules);
  }
  return tokens;
}

// ── Recipe generation + application ──────────────────────────────────────────

export function randomRecipe(rng: () => number = Math.random): RerollRecipe {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  return {
    hueShift: Math.round((rng() * 2 - 1) * 90),
    satMult: Number((0.6 + rng() * 0.9).toFixed(2)),
    lightShift: Math.round((rng() * 2 - 1) * 6),
    radiusMult: pick([0, 0.5, 1, 1, 1.5, 2]),
  };
}

export function describeRecipe(r: RerollRecipe): string {
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  return [
    `hue ${sign(r.hueShift)}°`,
    `sat ×${r.satMult}`,
    `light ${sign(r.lightShift)}`,
    `radius ×${r.radiusMult}`,
  ].join(" · ");
}

const DEFAULT_COLOR_PREFIXES = ["--color-"];
const DEFAULT_RADIUS_PREFIXES = ["--radius-"];

/**
 * Apply a recipe as inline overrides on :root. Returns the list of property
 * names that were overridden (for reset).
 */
export function applyRecipe(
  recipe: RerollRecipe,
  tokens: Map<string, string>,
  config?: RerollConfig,
): string[] {
  const colorPrefixes = config?.colorPrefixes ?? DEFAULT_COLOR_PREFIXES;
  const radiusPrefixes = config?.radiusPrefixes ?? DEFAULT_RADIUS_PREFIXES;
  const root = document.documentElement;
  const applied: string[] = [];
  for (const [name, value] of tokens) {
    if (colorPrefixes.some((p) => name.startsWith(p))) {
      const parsed = parseColor(value);
      const next = parsed && applyRecipeToColor(parsed, recipe);
      if (next) {
        root.style.setProperty(name, hslaToCss(next));
        applied.push(name);
      }
    } else if (radiusPrefixes.some((p) => name.startsWith(p))) {
      const m = value.match(/^([\d.]+)(px|rem|em)$/);
      if (m) {
        root.style.setProperty(name, `${(Number(m[1]) * recipe.radiusMult).toFixed(3)}${m[2]}`);
        applied.push(name);
      }
    }
  }
  return applied;
}

export function clearOverrides(names: string[]): void {
  const root = document.documentElement;
  for (const name of names) root.style.removeProperty(name);
}

// ── UI ───────────────────────────────────────────────────────────────────────

export type RerollPanelProps = {
  config?: RerollConfig;
  onClose: () => void;
  /** Called with the recipe whenever the user copies/keeps one. */
  onKeep?: (recipe: RerollRecipe) => void;
};

export function RerollPanel({ config, onClose, onKeep }: RerollPanelProps) {
  const tokens = useMemo(() => collectRootTokens(), []);
  const [recipe, setRecipe] = useState<RerollRecipe | null>(null);
  const [overridden, setOverridden] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const reroll = useCallback(() => {
    clearOverrides(overridden);
    const next = randomRecipe();
    setOverridden(applyRecipe(next, tokens, config));
    setRecipe(next);
    setCopied(false);
  }, [overridden, tokens, config]);

  const reset = useCallback(() => {
    clearOverrides(overridden);
    setOverridden([]);
    setRecipe(null);
    setCopied(false);
  }, [overridden]);

  const copy = useCallback(() => {
    if (!recipe) return;
    onKeep?.(recipe);
    try {
      void navigator.clipboard.writeText(JSON.stringify({ agentationReroll: recipe }, null, 2));
    } catch { /* clipboard unavailable — onKeep still fired */ }
    setCopied(true);
  }, [recipe, onKeep]);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.panel} data-agentation-reroll-panel data-agentation-ui>
      <span className={styles.label}>Re-roll</span>
      <button className={styles.roll} onClick={reroll}>
        {recipe ? "Roll again" : "Roll"}
      </button>
      <span className={styles.recipe}>
        {recipe ? describeRecipe(recipe) : `${tokens.size} tokens loaded`}
      </span>
      <button
        className={styles.action}
        onClick={copy}
        disabled={!recipe}
        title="Copy this recipe as JSON (paste it to your agent to make it real)"
      >
        {copied ? "Copied" : "Keep"}
      </button>
      <button className={styles.action} onClick={reset} disabled={!recipe}>
        Reset
      </button>
      <button className={styles.close} onClick={close} aria-label="Close re-roll">
        &times;
      </button>
    </div>,
    document.body,
  );
}
