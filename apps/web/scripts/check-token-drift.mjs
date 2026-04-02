import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "..");
const srcStylesRoot = path.join(webRoot, "src", "styles");
const baselinePath = path.join(__dirname, "token-drift-baseline.json");

const COLOR_LITERAL_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(abs));
    } else if (entry.isFile() && entry.name.endsWith(".css") && entry.name !== "tokens.css") {
      files.push(abs);
    }
  }
  return files;
}

function collectEntries() {
  const files = walk(srcStylesRoot);
  const entries = {};

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, "utf8");
    const rel = path.relative(webRoot, filePath).replace(/\\/g, "/");
    const matches = raw.match(COLOR_LITERAL_RE) ?? [];

    for (const match of matches) {
      const key = `${rel}::${match}`;
      entries[key] = (entries[key] ?? 0) + 1;
    }
  }

  return entries;
}

function loadBaseline() {
  if (!fs.existsSync(baselinePath)) {
    return { version: 1, entries: {} };
  }
  return JSON.parse(fs.readFileSync(baselinePath, "utf8"));
}

function saveBaseline(entries) {
  const baseline = {
    version: 1,
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
    violations.push(`NEW literal: ${key} (count ${count})`);
    continue;
  }
  if (count > allowed) {
    violations.push(`INCREASED literal count: ${key} (was ${allowed}, now ${count})`);
  }
}

if (violations.length > 0) {
  console.error("Token drift detected. Replace literals with tokens or refresh baseline intentionally.");
  for (const line of violations) {
    console.error(`- ${line}`);
  }
  process.exit(1);
}

console.log("Token drift check passed.");
