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

  it("keeps the create flow section order stable across styles and custom tabs", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <FlowStyleScreen
        isOpen
        styles={FALLBACK_STYLES}
        models={FALLBACK_MODELS}
        selectedStyle={FALLBACK_STYLES[0]}
        onSelectStyle={vi.fn()}
        onContinue={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const flowTop = container.querySelector(".flow-top");
    const flowTabs = container.querySelector(".flow-tabs");
    const sectionHeaders = container.querySelectorAll(".section-header");

    expect(flowTop).toBeTruthy();
    expect(flowTabs).toBeTruthy();
    expect(flowTop?.nextElementSibling).toBe(flowTabs);
    expect(flowTop).toHaveTextContent("Создать");
    expect(within(flowTabs as HTMLElement).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Стили",
      "Кастом",
    ]);
    expect(Array.from(sectionHeaders, (header) => header.textContent)).toEqual([
      "Тренды",
      "Бизнес и карьера",
      "Лайфстайл",
      "Арт и креатив",
      "Особый повод",
    ]);
    expect(container.querySelector(".section-header")?.parentElement).toBe(
      flowTabs?.nextElementSibling,
    );

    await user.click(screen.getByRole("button", { name: "Кастом" }));

    const customContent = container.querySelector(".custom-content");
    const customBottomBar = container.querySelector(".flow-bottom-bar.flow-bottom-bar-inline");
    expect(customContent).toBeTruthy();
    expect(customBottomBar).toBeTruthy();
    expect(flowTabs?.nextElementSibling).toBe(customContent);
    expect(customContent?.nextElementSibling).toBe(customBottomBar);

    const customFields = customContent?.children ?? [];
    expect(customFields).toHaveLength(4);
    expect(customFields[0]).toHaveTextContent("Модель");
    expect(customFields[1]).toHaveTextContent("Фото");
    expect(customFields[2]).toHaveTextContent("Описание стиля");
    expect(customFields[3]).toHaveTextContent("Соотношение сторон");
    expect(customFields[1].querySelector('input[type="file"]')).toBeTruthy();
    expect(customFields[1].querySelector(".upload-area")).toBeTruthy();
    expect(within(customBottomBar as HTMLElement).getByRole("button", { name: "Создать" })).toBeDisabled();
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

  it("keeps custom input state when parent rerenders with new models array", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <FlowStyleScreen
        isOpen
        styles={FALLBACK_STYLES}
        models={FALLBACK_MODELS}
        selectedStyle={FALLBACK_STYLES[0]}
        onSelectStyle={vi.fn()}
        onContinue={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Кастом" }));
    await user.type(screen.getByPlaceholderText("Опишите желаемый стиль фотосессии..."), "retain me");

    rerender(
      <FlowStyleScreen
        isOpen
        styles={FALLBACK_STYLES}
        models={[...FALLBACK_MODELS]}
        selectedStyle={FALLBACK_STYLES[0]}
        onSelectStyle={vi.fn()}
        onContinue={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Кастом" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByPlaceholderText("Опишите желаемый стиль фотосессии...")).toHaveValue("retain me");
  });
});
