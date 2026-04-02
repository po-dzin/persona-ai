import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FALLBACK_MODELS } from "../../data/models";
import { FALLBACK_PACKAGES } from "../../data/packages";
import { ModelsPricingScreen } from "../ModelsPricingScreen";

describe("ModelsPricingScreen", () => {
  it("keeps the pricing flow sections and retention rows in canon order", () => {
    const { container } = render(
      <ModelsPricingScreen
        isOpen
        models={FALLBACK_MODELS}
        packages={FALLBACK_PACKAGES}
        onClose={vi.fn()}
      />,
    );

    expect(container.firstElementChild).toHaveClass("overlay-screen", "pricing-screen");
    expect(container.querySelector(".flow-top")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Назад" })).toBeInTheDocument();
    expect(screen.getByText("Описание тарифов")).toBeInTheDocument();
    expect(screen.getByText("Nano Banana")).toBeInTheDocument();
    expect(screen.getByText("10 🪙")).toBeInTheDocument();
    expect(screen.getByText("Хранение фотографий")).toBeInTheDocument();
    expect(screen.getAllByText("30 дней")).toHaveLength(2);

    const subtitle = container.querySelector(".pricing-subtitle");
    const modelsList = container.querySelector(".pricing-models-list");
    const storageTitle = screen.getByText("Хранение фотографий");
    const storageList = container.querySelector(".pricing-storage-list");
    const note = container.querySelector(".pricing-note");
    const tail = container.querySelector(".screen-tail-space");

    expect(subtitle).toBeTruthy();
    expect(subtitle?.querySelectorAll("br")).toHaveLength(1);
    expect(subtitle).toHaveTextContent("Стоимость генерации зависит от выбранной AI-модели.");
    expect(subtitle).toHaveTextContent("Чем мощнее модель — тем выше качество результата.");
    expect(modelsList?.children).toHaveLength(FALLBACK_MODELS.length);
    expect(storageList?.children).toHaveLength(FALLBACK_PACKAGES.filter((pkg) => pkg.code !== "TEST").length);
    expect(subtitle?.nextElementSibling).toBe(modelsList);
    expect(modelsList?.nextElementSibling).toBe(storageTitle);
    expect(storageTitle.nextElementSibling).toBe(storageList);
    expect(storageList?.nextElementSibling).toBe(note);
    expect(note?.nextElementSibling).toBe(tail);
    expect(container.querySelectorAll(".pricing-days.long")).toHaveLength(2);
    expect(container.firstElementChild?.lastElementChild).toHaveClass("screen-tail-space");
  });
});
