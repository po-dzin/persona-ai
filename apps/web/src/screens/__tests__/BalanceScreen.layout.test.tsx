import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FALLBACK_PACKAGES } from "../../data/packages";
import { BalanceScreen } from "../BalanceScreen";

describe("BalanceScreen layout", () => {
  it("renders featured tag above price inside the right column for POPULAR package", () => {
    const { container } = render(
      <BalanceScreen
        credits={6078}
        packages={FALLBACK_PACKAGES}
        onSelectPackage={vi.fn()}
        onOpenPricing={vi.fn()}
      />,
    );

    expect(container.firstElementChild).toHaveClass("screen");

    const popularCard = screen.getByRole("button", { name: /Popular/i });
    expect(within(popularCard).getByText("Популярное")).toBeInTheDocument();

    const rightCol = popularCard.querySelector(".package-right");
    expect(rightCol).toBeTruthy();
    expect(rightCol?.firstElementChild).toHaveClass("package-featured-tag");
    expect(rightCol?.firstElementChild).toHaveTextContent("Популярное");

    expect(container.firstElementChild?.lastElementChild).toHaveClass("screen-tail-space");
  });
});
