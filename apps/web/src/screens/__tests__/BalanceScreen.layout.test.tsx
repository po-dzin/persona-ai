import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FALLBACK_PACKAGES } from "../../data/packages";
import { BalanceScreen } from "../BalanceScreen";

describe("BalanceScreen layout", () => {
  it("keeps the hero stack, featured package rail, and footer tail in canon order", () => {
    const { container } = render(
      <BalanceScreen
        credits={6078}
        packages={FALLBACK_PACKAGES}
        onSelectPackage={vi.fn()}
        onOpenPricing={vi.fn()}
      />,
    );

    expect(container.firstElementChild).toHaveClass("screen");

    const hero = container.querySelector(".balance-hero");
    expect(hero).toBeTruthy();
    expect(hero?.children[0]).toHaveClass("balance-coin-icon");
    expect(hero?.children[1]).toHaveClass("balance-amount");
    expect(hero?.children[2]).toHaveClass("balance-label");

    const sectionTitle = container.querySelector(".balance-section-title");
    const packagesList = container.querySelector(".packages-list");
    expect(sectionTitle).toHaveTextContent("Пополнить баланс");
    expect(packagesList?.children).toHaveLength(FALLBACK_PACKAGES.length);
    expect(hero?.nextElementSibling).toBe(sectionTitle);
    expect(sectionTitle?.nextElementSibling).toBe(packagesList);

    const popularCard = screen.getByRole("button", { name: /Popular/i });
    expect(popularCard).toHaveClass("package-card", "featured");
    expect(within(popularCard).getByText("Популярное")).toBeInTheDocument();

    const rightCol = popularCard.querySelector(".package-right");
    expect(rightCol).toBeTruthy();
    expect(rightCol?.children[0]).toHaveClass("package-featured-tag");
    expect(rightCol?.children[1]).toHaveClass("package-price");
    expect(rightCol?.children[2]).toHaveClass("package-bonus");

    const footerCopy = container.querySelector(".balance-footer-copy");
    const pricingLink = container.querySelector(".balance-pricing-link");
    const tail = container.querySelector(".screen-tail-space");

    expect(footerCopy).toBeTruthy();
    expect(pricingLink).toBeTruthy();
    expect(tail).toBeTruthy();
    expect(footerCopy?.nextElementSibling).toBe(pricingLink);
    expect(pricingLink?.nextElementSibling).toBe(tail);
    expect(container.firstElementChild?.lastElementChild).toHaveClass("screen-tail-space");
  });
});
