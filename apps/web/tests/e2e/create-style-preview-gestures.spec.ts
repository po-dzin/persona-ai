import { expect, test, type Page } from "@playwright/test";

async function dispatchTouch(page: Page, selector: string, type: "touchstart" | "touchmove" | "touchend", start: { x: number; y: number }, end?: { x: number; y: number }) {
  const point = end ?? start;
  const payload =
    type === "touchend"
      ? { changedTouches: [{ clientX: point.x, clientY: point.y, identifier: 1 }], touches: [] }
      : { touches: [{ clientX: point.x, clientY: point.y, identifier: 1 }], changedTouches: [{ clientX: point.x, clientY: point.y, identifier: 1 }] };
  await page.dispatchEvent(selector, type, payload);
}

test("create flow style preview keeps gesture transitions stable", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByText("Создать").first()).toBeVisible();

  const firstStyleCard = page.locator(".styles-scroll .style-card").first();
  await expect(firstStyleCard).toBeVisible();
  await firstStyleCard.click();

  const previewScreen = page.locator(".style-preview-screen");
  const previewHero = page.locator(".style-preview-hero");
  await expect(previewScreen).toBeVisible();
  await expect(previewHero).toBeVisible();

  const initialStyleName = (await page.locator(".style-preview-name-top").first().innerText()).trim();

  await dispatchTouch(page, ".style-preview-hero", "touchstart", { x: 260, y: 190 });
  await dispatchTouch(page, ".style-preview-hero", "touchmove", { x: 260, y: 190 }, { x: 150, y: 194 });
  await dispatchTouch(page, ".style-preview-hero", "touchend", { x: 260, y: 190 }, { x: 150, y: 194 });
  await page.waitForTimeout(360);

  const nextStyleName = (await page.locator(".style-preview-name-top").first().innerText()).trim();
  expect(nextStyleName).not.toEqual(initialStyleName);

  await dispatchTouch(page, ".style-preview-hero", "touchstart", { x: 190, y: 130 });
  await dispatchTouch(page, ".style-preview-hero", "touchmove", { x: 190, y: 130 }, { x: 188, y: 280 });
  await dispatchTouch(page, ".style-preview-hero", "touchend", { x: 190, y: 130 }, { x: 188, y: 280 });
  await page.waitForTimeout(260);

  await expect(previewScreen).toBeHidden();
  await expect(page.locator(".flow-title", { hasText: "Загрузить фото" })).toBeHidden();
  await expect(firstStyleCard).toBeVisible();

  await firstStyleCard.click();
  await expect(previewScreen).toBeVisible();
});
