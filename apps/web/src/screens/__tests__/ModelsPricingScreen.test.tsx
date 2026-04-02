import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FALLBACK_MODELS } from "../../data/models";
import { FALLBACK_PACKAGES } from "../../data/packages";
import { ModelsPricingScreen } from "../ModelsPricingScreen";

describe("ModelsPricingScreen", () => {
  it("shows model costs and storage retention blocks", () => {
    const { container } = render(
      <ModelsPricingScreen
        isOpen
        models={FALLBACK_MODELS}
        packages={FALLBACK_PACKAGES}
        onClose={vi.fn()}
      />,
    );

    expect(container.firstElementChild).toHaveClass("overlay-screen", "pricing-screen");
    expect(screen.getByText("Описание тарифов")).toBeInTheDocument();
    expect(screen.getByText("Nano Banana")).toBeInTheDocument();
    expect(screen.getByText("10 🪙")).toBeInTheDocument();
    expect(screen.getByText("Хранение фотографий")).toBeInTheDocument();
    expect(screen.getAllByText("30 дней")).toHaveLength(2);
    expect(container.firstElementChild?.lastElementChild).toHaveClass("screen-tail-space");
  });
});
