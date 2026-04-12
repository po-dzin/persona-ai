import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function read(relPath) {
  const abs = path.resolve(process.cwd(), relPath);
  return fs.readFileSync(abs, "utf8");
}

function assertMatch(haystack, regex, message) {
  if (!regex.test(haystack)) {
    throw new Error(message);
  }
}

function run() {
  const html = read("index.html");
  const css = read("src/index.css");
  const chartTsx = read("src/components/Chart.tsx");

  // 1) Mobile anti-zoom contract in viewport meta.
  assertMatch(
    html,
    /<meta\s+name="viewport"\s+content="[^"]*viewport-fit=cover[^"]*maximum-scale=1[^"]*user-scalable=no[^"]*"\s*\/?>/i,
    "index.html must lock mobile zoom in viewport meta (viewport-fit=cover, maximum-scale=1, user-scalable=no).",
  );

  // 2) Safe-area aware top bar and content offset.
  assertMatch(
    css,
    /--cmp-safe-top:\s*env\(safe-area-inset-top,\s*0px\);/,
    "index.css must define --cmp-safe-top token.",
  );
  assertMatch(
    css,
    /\.topbar\s*\{[\s\S]*top:\s*var\(--safe-top\);[\s\S]*\}/,
    "topbar must be anchored using safe-area offset.",
  );
  assertMatch(
    css,
    /@media\s*\(max-width:\s*639px\)\s*\{[\s\S]*\.layout-main\s*\{[\s\S]*padding-top:\s*calc\(var\(--topbar-h\)\s*\+\s*var\(--safe-top\)\s*\+\s*16px\);[\s\S]*\}[\s\S]*\}/,
    "mobile layout-main must reserve space for topbar + safe-area.",
  );

  // 3) Charts must support horizontal scroll on narrow screens.
  assertMatch(
    css,
    /\.chart-scroll-x\s*\{[\s\S]*overflow-x:\s*auto;[\s\S]*\}/,
    "index.css must contain .chart-scroll-x with horizontal scroll.",
  );
  assertMatch(
    chartTsx,
    /className="chart-scroll-x"/,
    "LineChart/BarChart must use chart-scroll-x wrapper.",
  );

  // 4) Mobile gesture contract: no pinch-zoom side effects.
  assertMatch(
    css,
    /body\s*\{[\s\S]*touch-action:\s*pan-x pan-y;[\s\S]*\}/,
    "body must restrict touch-action to pan axes for mobile stability.",
  );

  console.log("Admin mobile contract tests passed.");
}

run();
