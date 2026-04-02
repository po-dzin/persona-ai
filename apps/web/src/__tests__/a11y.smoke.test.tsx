import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TabBar } from "../components/TabBar";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "../..");

const indexCss = fs.readFileSync(path.join(webRoot, "src/styles/index.css"), "utf8");
const tokensCss = fs.readFileSync(path.join(webRoot, "src/styles/tokens.css"), "utf8");

function parseCssVars(rawCss: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let match: RegExpExecArray | null = re.exec(rawCss);
  while (match) {
    vars[`--${match[1]}`] = match[2].trim();
    match = re.exec(rawCss);
  }
  return vars;
}

const vars = parseCssVars(tokensCss);

function resolveCssValue(value: string, stack: string[] = []): string {
  const trimmed = value.trim();
  const varMatch = trimmed.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^()]+))?\)$/i);
  if (!varMatch) return trimmed;

  const varName = varMatch[1];
  if (stack.includes(varName)) {
    throw new Error(`Circular CSS var reference: ${stack.join(" -> ")} -> ${varName}`);
  }

  const nextValue = vars[varName] ?? varMatch[2];
  if (!nextValue) {
    throw new Error(`Missing CSS variable ${varName}`);
  }

  return resolveCssValue(nextValue, [...stack, varName]);
}

type Rgb = { r: number; g: number; b: number };

function parseColor(value: string): Rgb {
  const resolved = resolveCssValue(value);

  const hex = resolved.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1];
    const normalized = raw.length === 3
      ? raw.split("").map((c) => `${c}${c}`).join("")
      : raw;
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
  }

  const rgb = resolved.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+))?\s*\)$/i);
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
    };
  }

  throw new Error(`Unsupported color format in a11y smoke test: ${resolved}`);
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const srgb = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(parseColor(fg));
  const l2 = relativeLuminance(parseColor(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function cssBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, "m");
  const match = indexCss.match(re);
  if (!match) {
    throw new Error(`Missing CSS block for selector: ${selector}`);
  }
  return match[1];
}

function resolvePx(value: string): number {
  const resolved = resolveCssValue(value);
  const px = resolved.match(/^(-?\d*\.?\d+)px$/);
  if (!px) {
    throw new Error(`Expected px value, got: ${resolved}`);
  }
  return Number(px[1]);
}

function readDeclaration(block: string, prop: string): string {
  const re = new RegExp(`${prop}\\s*:\\s*([^;]+);`, "m");
  const match = block.match(re);
  if (!match) {
    throw new Error(`Missing declaration ${prop}`);
  }
  return match[1].trim();
}

describe("a11y smoke", () => {
  it("supports keyboard navigation on primary tab controls", async () => {
    const onChange = vi.fn();
    const onOpenCreate = vi.fn();
    const user = userEvent.setup();

    render(
      <TabBar
        activeScreen="home"
        isCreateActive={false}
        photosBadge={0}
        onChange={onChange}
        onOpenCreate={onOpenCreate}
      />,
    );

    const home = screen.getByRole("button", { name: "Главная" });
    const photos = screen.getByRole("button", { name: "Мои фото" });
    const create = screen.getByRole("button", { name: "Создать" });

    await user.tab();
    expect(home).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("home");

    await user.tab();
    expect(photos).toHaveFocus();

    await user.tab();
    expect(create).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onOpenCreate).toHaveBeenCalled();
  });

  it("keeps focus-visible and touch-target contracts", () => {
    expect(indexCss).toMatch(/:focus-visible/);
    expect(indexCss).toMatch(/--cmp-focus-ring-color/);

    const minTouchTarget = resolvePx(vars["--cmp-touch-min-size"]);
    expect(minTouchTarget).toBeGreaterThanOrEqual(44);

    const tabItemBlock = cssBlock(".tab-item");
    expect(resolvePx(readDeclaration(tabItemBlock, "width"))).toBeGreaterThanOrEqual(44);
    expect(resolvePx(readDeclaration(tabItemBlock, "height"))).toBeGreaterThanOrEqual(44);

    const tabAiBlock = cssBlock(".tab-ai");
    expect(resolvePx(readDeclaration(tabAiBlock, "height"))).toBeGreaterThanOrEqual(44);

    const flowBackBlock = cssBlock(".flow-back");
    expect(resolvePx(readDeclaration(flowBackBlock, "width"))).toBeGreaterThanOrEqual(44);
    expect(resolvePx(readDeclaration(flowBackBlock, "height"))).toBeGreaterThanOrEqual(44);
  });

  it("keeps AA contrast for primary semantic text/background pairs", () => {
    const pairs: Array<[string, string, number]> = [
      ["--sem-color-text-primary", "--sem-color-bg-body", 4.5],
      ["--sem-color-text-secondary", "--sem-color-bg-body", 4.5],
      ["--sem-color-text-primary", "--sem-color-bg-surface", 4.5],
      ["--sem-color-text-secondary", "--sem-color-bg-surface", 4.5],
    ];

    for (const [fg, bg, minContrast] of pairs) {
      const ratio = contrastRatio(`var(${fg})`, `var(${bg})`);
      expect(ratio).toBeGreaterThanOrEqual(minContrast);
    }
  });
});
