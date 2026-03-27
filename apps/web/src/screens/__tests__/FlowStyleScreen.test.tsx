import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FALLBACK_MODELS } from "../../data/models";
import { FALLBACK_STYLES } from "../../data/styles";
import { FlowStyleScreen } from "../FlowStyleScreen";

describe("FlowStyleScreen", () => {
  it("calls onSelectStyle in styles tab", async () => {
    const user = userEvent.setup();
    const onSelectStyle = vi.fn();

    render(
      <FlowStyleScreen
        isOpen
        styles={FALLBACK_STYLES}
        models={FALLBACK_MODELS}
        selectedStyle={FALLBACK_STYLES[0]}
        onSelectStyle={onSelectStyle}
        onContinue={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const trendsHeader = screen.getByText("Тренды");
    const trendsBlock = trendsHeader.parentElement?.nextElementSibling;
    expect(trendsBlock).not.toBeNull();

    const hollywoodButton = within(trendsBlock as HTMLElement).getByRole("button", {
      name: /Голливуд/,
    });

    await user.click(hollywoodButton);

    expect(onSelectStyle).toHaveBeenCalledTimes(1);
    expect(onSelectStyle).toHaveBeenCalledWith(
      expect.objectContaining({ id: "hollywood" }),
    );
  });

  it("enables create in custom tab only after valid prompt and photo, then calls onContinue", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();

    const { container } = render(
      <FlowStyleScreen
        isOpen
        styles={FALLBACK_STYLES}
        models={FALLBACK_MODELS}
        selectedStyle={FALLBACK_STYLES[0]}
        onSelectStyle={vi.fn()}
        onContinue={onContinue}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Кастом" }));

    const createButton = screen.getByRole("button", { name: "Создать" });
    expect(createButton).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText("Опишите желаемый стиль фотосессии..."),
      "Сдержанный editorial стиль",
    );

    const file = new File(["fake"], "portrait.png", { type: "image/png" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    await user.upload(input as HTMLInputElement, file);

    expect(createButton).toBeEnabled();

    await user.click(createButton);

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTab: "custom",
        prompt: "Сдержанный editorial стиль",
        modelId: "nano-banana-v1",
        aspectRatio: "1:1",
        photoFile: file,
      }),
    );
  });
});
