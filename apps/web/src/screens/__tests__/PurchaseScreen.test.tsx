import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FALLBACK_PACKAGES } from "../../data/packages";
import { PurchaseScreen } from "../PurchaseScreen";

describe("PurchaseScreen", () => {
  it("renders selected package summary and confirms tg stars purchase", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <PurchaseScreen
        isOpen
        selectedPackage={FALLBACK_PACKAGES.find((pkg) => pkg.code === "POPULAR") ?? null}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Подтверждение")).toBeInTheDocument();
    expect(screen.getByText("К оплате")).toBeInTheDocument();
    expect(screen.getByText("799 ⭐")).toBeInTheDocument();

    const tgMethod = screen.getByRole("button", { name: /Telegram Stars/i });
    expect(tgMethod).toHaveClass("active");
    expect(screen.getByRole("button", { name: /Stripe/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Купить" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ code: "POPULAR", priceStars: 799 }),
    );
  });
});
