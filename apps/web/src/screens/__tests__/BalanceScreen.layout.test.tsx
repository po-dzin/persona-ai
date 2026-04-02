import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FALLBACK_PACKAGES } from "../../data/packages";
import { BalanceScreen } from "../BalanceScreen";

describe("BalanceScreen layout", () => {
  it("keeps the hero, package rail, and footer order stable", () => {
    const { container } = render(
      <BalanceScreen
        credits={6078}
        packages={FALLBACK_PACKAGES}
        onSelectPackage={vi.fn()}
        onOpenPricing={vi.fn()}
      />,
    );

    const hero = container.querySelector(".balance-hero");
    expect(hero).toBeTruthy();
    expect(hero).toHaveTextContent("🪙");
    expect(hero).toHaveTextContent("6078");
    expect(hero).toHaveTextContent("монет на балансе");

    const sectionTitle = container.querySelector(".balance-section-title");
    const packagesList = container.querySelector(".packages-list");
    expect(packagesList).toBeTruthy();
    expect(sectionTitle).toHaveTextContent("Пополнить баланс");
    expect(within(packagesList as HTMLElement).getAllByRole("button")).toHaveLength(FALLBACK_PACKAGES.length);
    expect(hero?.nextElementSibling).toBe(sectionTitle);
    expect(sectionTitle?.nextElementSibling).toBe(packagesList);

    const packageButtons = within(packagesList as HTMLElement).getAllByRole("button");
    expect(packageButtons).toHaveLength(FALLBACK_PACKAGES.length);
    packageButtons.forEach((button, index) => {
      expect(button).toHaveTextContent(FALLBACK_PACKAGES[index].title);
    });

    const popularPackage = FALLBACK_PACKAGES.find((pkg) => pkg.code === "POPULAR");
    expect(popularPackage).toBeTruthy();

    const popularCard = packageButtons.find((button) =>
      within(button).queryByText("Популярное"),
    );
    expect(popularCard).toBeTruthy();
    expect(popularCard).toHaveTextContent(popularPackage!.title);
    expect(popularCard).toHaveTextContent(`${popularPackage!.credits} монет`);
    expect(popularCard).toHaveTextContent(`${popularPackage!.priceStars} ⭐`);
    expect(within(popularCard as HTMLElement).getByText("Популярное")).toBeInTheDocument();

    const footerCopy = container.querySelector(".balance-footer-copy");
    const pricingLink = container.querySelector(".balance-pricing-link");
    const tail = container.querySelector(".screen-tail-space");

    expect(footerCopy).toBeTruthy();
    expect(pricingLink).toBeTruthy();
    expect(tail).toBeTruthy();
    expect(footerCopy).toHaveTextContent("Оплата через Telegram Stars.");
    expect(footerCopy).toHaveTextContent("Монеты начисляются мгновенно.");
    expect(pricingLink).toHaveTextContent("Описание тарифов →");
    expect(footerCopy?.nextElementSibling).toBe(pricingLink);
    expect(pricingLink?.nextElementSibling).toBe(tail);
    expect(container.firstElementChild?.lastElementChild).toHaveClass("screen-tail-space");
  });
});
