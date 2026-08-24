import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  parseSimpleColor,
  applyRecipeToColor,
  hslaToCss,
  randomRecipe,
  describeRecipe,
  applyRecipe,
  clearOverrides,
  RerollPanel,
  type RerollRecipe,
} from "./index";

const RECIPE: RerollRecipe = { hueShift: 30, satMult: 1.2, lightShift: 4, radiusMult: 2 };

describe("parseSimpleColor", () => {
  it("parses 6-digit hex", () => {
    const c = parseSimpleColor("#3AA9E9")!;
    expect(Math.round(c.h)).toBe(202);
    expect(c.s).toBeGreaterThan(70);
    expect(c.a).toBe(1);
  });

  it("parses 8-digit hex with alpha", () => {
    const c = parseSimpleColor("#18160e0d")!;
    expect(c.a).toBeCloseTo(0.051, 2);
  });

  it("parses rgb() and returns null for unknown formats", () => {
    expect(parseSimpleColor("rgb(255, 0, 0)")!.h).toBe(0);
    expect(parseSimpleColor("lab(48% 0 0)")).toBeNull();
    expect(parseSimpleColor("nonsense")).toBeNull();
  });
});

describe("applyRecipeToColor", () => {
  it("rotates hue, scales saturation, shifts lightness", () => {
    const out = applyRecipeToColor({ h: 350, s: 50, l: 50, a: 1 }, RECIPE)!;
    expect(out.h).toBe(20);
    expect(out.s).toBe(60);
    expect(out.l).toBe(54);
  });

  it("leaves near-achromatic colors untouched (returns null)", () => {
    expect(applyRecipeToColor({ h: 100, s: 5, l: 50, a: 1 }, RECIPE)).toBeNull();
  });

  it("clamps saturation and lightness into safe ranges", () => {
    const out = applyRecipeToColor({ h: 0, s: 95, l: 95, a: 1 }, RECIPE)!;
    expect(out.s).toBeLessThanOrEqual(100);
    expect(out.l).toBeLessThanOrEqual(96);
  });
});

describe("applyRecipe / clearOverrides", () => {
  it("overrides color and radius tokens on :root and clears them", () => {
    const tokens = new Map([
      ["--color-french", "#3AA9E9"],
      ["--color-neutral-500", "rgb(120, 120, 120)"], // achromatic → skipped
      ["--radius-md", "0.5rem"],
      ["--font-sans", "Outfit"], // unrelated → skipped
    ]);
    const applied = applyRecipe(RECIPE, tokens);
    expect(applied.sort()).toEqual(["--color-french", "--radius-md"]);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--color-french")).toMatch(/^hsl\(/);
    expect(root.style.getPropertyValue("--radius-md")).toBe("1.000rem");
    clearOverrides(applied);
    expect(root.style.getPropertyValue("--color-french")).toBe("");
  });
});

describe("randomRecipe / describeRecipe", () => {
  it("stays within bounds and describes itself", () => {
    const r = randomRecipe(() => 0.999);
    expect(Math.abs(r.hueShift)).toBeLessThanOrEqual(90);
    expect(r.satMult).toBeLessThanOrEqual(1.5);
    expect([0, 0.5, 1, 1.5, 2]).toContain(r.radiusMult);
    expect(describeRecipe(RECIPE)).toBe("hue +30° · sat ×1.2 · light +4 · radius ×2");
  });
});

describe("RerollPanel", () => {
  it("rolls, keeps (fires onKeep), and resets", () => {
    const onKeep = vi.fn();
    render(<RerollPanel onClose={() => {}} onKeep={onKeep} />);
    fireEvent.click(screen.getByText("Roll"));
    expect(screen.getByText(/hue [+-]\d+°/)).toBeTruthy();
    fireEvent.click(screen.getByText("Keep"));
    expect(onKeep).toHaveBeenCalledWith(
      expect.objectContaining({ hueShift: expect.any(Number) })
    );
    fireEvent.click(screen.getByText("Reset"));
    expect(screen.queryByText(/hue [+-]\d+°/)).toBeNull();
  });

  it("clears overrides when closed", () => {
    const onClose = vi.fn();
    render(<RerollPanel onClose={onClose} />);
    fireEvent.click(screen.getByText("Roll"));
    fireEvent.click(screen.getByLabelText("Close re-roll"));
    expect(onClose).toHaveBeenCalled();
    expect(document.documentElement.getAttribute("style") || "").not.toMatch(/--color-/);
  });
});
