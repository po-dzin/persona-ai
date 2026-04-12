import { expect, test } from "@playwright/test";

const overviewPayload = {
  period_days: 7,
  users: {
    total: 2,
    paying: 2,
    conversion_pct: 100,
    new_today: 0,
    new_period: 0,
    dau: 0,
  },
  generations: {
    today: { done: 0, failed: 0, total: 0 },
    period: { done: 0, failed: 0, total: 0 },
    alltime_done: 0,
    alltime_total: 0,
    error_rate_pct: 0,
  },
  revenue: {
    today_stars: 0,
    period_stars: 0,
    alltime_stars: 0,
    arppu_stars: 1899,
  },
  queue: {
    orders: {},
    jobs: {},
  },
};

const timeseriesPayload = {
  days: 14,
  users: [
    { day: "2026-03-28", new_users: 1 },
    { day: "2026-03-29", new_users: 1 },
    { day: "2026-03-30", new_users: 1 },
  ],
  orders: [
    { day: "2026-03-30", total: 5, done: 5, failed: 0 },
    { day: "2026-03-31", total: 4, done: 4, failed: 0 },
    { day: "2026-04-01", total: 1, done: 1, failed: 0 },
  ],
  revenue: [
    { day: "2026-03-28", stars: 2000 },
    { day: "2026-03-29", stars: 1800 },
    { day: "2026-03-30", stars: 100 },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route("**/admin/api/overview**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(overviewPayload),
    });
  });
  await page.route("**/admin/api/timeseries**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(timeseriesPayload),
    });
  });
});

test("mobile dashboard keeps topbar offset, anti-zoom contract, and chart fit/scroll behavior", async ({ page }) => {
  await page.goto("/?token=e2e-admin");

  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();

  const viewportContent = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewportContent).toContain("maximum-scale=1");
  expect(viewportContent).toContain("user-scalable=no");
  expect(viewportContent).toContain("viewport-fit=cover");

  const topbar = page.locator(".topbar");
  const title = page.locator(".page-title");
  await expect(topbar).toBeVisible();
  await expect(title).toBeVisible();

  const topbarBox = await topbar.boundingBox();
  const titleBox = await title.boundingBox();
  expect(topbarBox).toBeTruthy();
  expect(titleBox).toBeTruthy();
  expect(titleBox!.y).toBeGreaterThanOrEqual(topbarBox!.y + topbarBox!.height - 1);

  const chartWrappers = page.locator(".chart-scroll-x");
  await expect(chartWrappers).toHaveCount(3);

  const chartContract = await chartWrappers.evaluateAll((nodes) => {
    return nodes.map((node) => {
      const el = node as HTMLElement;
      const style = getComputedStyle(el);
      return {
        overflowX: style.overflowX,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
      };
    });
  });

  chartContract.forEach((entry) => {
    expect(["auto", "scroll"]).toContain(entry.overflowX);
    expect(entry.clientWidth).toBeGreaterThan(0);
    expect(entry.scrollWidth).toBeGreaterThanOrEqual(entry.clientWidth);
  });

  const pageHasHorizontalOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
  expect(pageHasHorizontalOverflow).toBeFalsy();
});

