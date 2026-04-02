import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(webRoot, "src");
const baselinePath = path.join(__dirname, "token-drift-baseline.json");

const COLOR_LITERAL_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
const HARDCODED_CSS_RE = /(padding|margin|gap|font-size|letter-spacing|line-height)\s*:\s*[^;]*\d+px/g;
const HARDCODED_TSX_RE = /(padding|margin|gap|fontSize|letterSpacing|lineHeight)\s*:\s*("[^"]*\d+px"|'[^']*\d+px'|\d+(?:\.\d+)?)/g;
const MOTION_DECL_RE = /(?:^|[;{]\s*)(transition(?:-duration|-delay|-timing-function)?|animation(?:-duration|-delay|-timing-function)?)\s*:\s*([^;{}]+)(?=;|})/g;
const RAW_DURATION_RE = /(^|[^-\w])\d+(?:\.\d+)?(?:ms|s)\b/g;
const RAW_EASING_RE = /\b(ease-in-out|ease-in|ease-out|steps|linear)\b|cubic-bezier\s*\(/g;
const INLINE_STYLE_RE = /style=\{\{([\s\S]*?)\}\}/g;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      files.push(...walk(abs));
      continue;
    }
    if (!entry.isFile()) continue;

    if (entry.name.endsWith(".css") || entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") || entry.name.endsWith(".js") || entry.name.endsWith(".jsx")) {
      files.push(abs);
    }
  }

  return files;
}

function relPath(filePath) {
  return path.relative(webRoot, filePath).replace(/\\/g, "/");
}

function normalizeSnippet(value) {
  return value.replace(/\s+/g, " ").trim();
}

function maskTokenizedMotionValues(value) {
  return value
    .replace(/var\(--cmp-motion-[^)]+\)/g, "__MOTION_TOKEN__")
    .replace(/var\(--cmp-ease-[^)]+\)/g, "__EASE_TOKEN__");
}

function collectMotionViolations(raw, rel) {
  const violations = [];
  let motionMatch;

  while ((motionMatch = MOTION_DECL_RE.exec(raw)) !== null) {
    const property = motionMatch[1] ?? "";
    const value = motionMatch[2] ?? "";
    const normalizedValue = normalizeSnippet(value);

    if (!normalizedValue) continue;

    if (
      normalizedValue === "none" ||
      normalizedValue === "initial" ||
      normalizedValue === "inherit" ||
      normalizedValue === "unset" ||
      normalizedValue === "revert" ||
      normalizedValue === "revert-layer"
    ) {
      continue;
    }

    const maskedValue = maskTokenizedMotionValues(normalizedValue);
    const hasRawDuration = RAW_DURATION_RE.test(maskedValue);
    RAW_DURATION_RE.lastIndex = 0;
    const hasRawEasing = RAW_EASING_RE.test(maskedValue);
    RAW_EASING_RE.lastIndex = 0;

    if (!hasRawDuration && !hasRawEasing) continue;

    violations.push(`motion_css::${rel}::${property}::${normalizedValue}`);
  }

  MOTION_DECL_RE.lastIndex = 0;
  return violations;
}

function isAllowedInlineStyle(snippet) {
  const normalized = normalizeSnippet(snippet);
  const allowedPatterns = [
    "style.gradient",
    "background: bg",
    "selectedStyle?.gradient",
    "PACKAGE_ICON_BG",
    "${size.width}px",
    "${size.height}px",
    "var(--sem-gradient-photo-fallback)",
    "var(--sem-color-package-icon-fallback)",
    "panelsHeight",
  ];

  return allowedPatterns.some((pattern) => normalized.includes(pattern));
}

function collectEntries() {
  const files = walk(srcRoot);
  const entries = {};

  for (const filePath of files) {
    const rel = relPath(filePath);
    const raw = fs.readFileSync(filePath, "utf8");
    const isTokensFile = rel === "src/styles/tokens.css";
    const isCss = rel.endsWith(".css");
    const isCode = /\.(ts|tsx|js|jsx)$/.test(rel);

    if (isCss && !isTokensFile) {
      const colorMatches = raw.match(COLOR_LITERAL_RE) ?? [];
      for (const match of colorMatches) {
        const key = `color_literal_css::${rel}::${match}`;
        entries[key] = (entries[key] ?? 0) + 1;
      }

      const hardcodedMatches = raw.match(HARDCODED_CSS_RE) ?? [];
      for (const match of hardcodedMatches) {
        const key = `hardcoded_css::${rel}::${normalizeSnippet(match)}`;
        entries[key] = (entries[key] ?? 0) + 1;
      }

      const motionViolations = collectMotionViolations(raw, rel);
      for (const violation of motionViolations) {
        entries[violation] = (entries[violation] ?? 0) + 1;
      }
    }

    if (isCode) {
      const colorMatches = raw.match(COLOR_LITERAL_RE) ?? [];
      for (const match of colorMatches) {
        const key = `color_literal_code::${rel}::${match}`;
        entries[key] = (entries[key] ?? 0) + 1;
      }

      const hardcodedMatches = raw.match(HARDCODED_TSX_RE) ?? [];
      for (const match of hardcodedMatches) {
        const key = `hardcoded_code::${rel}::${normalizeSnippet(match)}`;
        entries[key] = (entries[key] ?? 0) + 1;
      }

      let inlineMatch;
      while ((inlineMatch = INLINE_STYLE_RE.exec(raw)) !== null) {
        const snippet = inlineMatch[1] ?? "";
        if (isAllowedInlineStyle(snippet)) continue;
        const key = `inline_style_forbidden::${rel}::${normalizeSnippet(snippet)}`;
        entries[key] = (entries[key] ?? 0) + 1;
      }
    }
  }

  return entries;
}

function loadBaseline() {
  if (!fs.existsSync(baselinePath)) {
    return { version: 2, entries: {} };
  }
  return JSON.parse(fs.readFileSync(baselinePath, "utf8"));
}

function saveBaseline(entries) {
  const baseline = {
    version: 2,
    generatedAt: new Date().toISOString(),
    entries,
  };
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
}

const writeMode = process.argv.includes("--write-baseline");
const currentEntries = collectEntries();

if (writeMode) {
  saveBaseline(currentEntries);
  console.log(`Token-drift baseline updated: ${path.relative(process.cwd(), baselinePath)}`);
  process.exit(0);
}

const baseline = loadBaseline();
const baselineEntries = baseline.entries ?? {};
const violations = [];

for (const [key, count] of Object.entries(currentEntries)) {
  const allowed = baselineEntries[key];
  if (allowed === undefined) {
    violations.push(`NEW violation: ${key} (count ${count})`);
    continue;
  }
  if (count > allowed) {
    violations.push(`INCREASED violation count: ${key} (was ${allowed}, now ${count})`);
  }
}

if (violations.length > 0) {
  console.error("Token drift detected. Replace literals/hardcoded values with tokens or refresh baseline intentionally.");
  for (const line of violations) {
    console.error(`- ${line}`);
  }
  process.exit(1);
}

console.log("Token drift check passed.");
