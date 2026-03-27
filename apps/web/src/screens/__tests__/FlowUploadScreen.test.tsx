import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FALLBACK_STYLES } from "../../data/styles";
import { FlowUploadScreen } from "../FlowUploadScreen";

describe("FlowUploadScreen", () => {
  it("hides prompt block for style flow and enables create after file upload", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    const { container } = render(
      <FlowUploadScreen
        isOpen
        selectedStyle={FALLBACK_STYLES[0]}
        prompt="Cinematic hollywood portrait"
        aspectRatio="1:1"
        isSubmitting={false}
        showPromptBlock={false}
        onGenerate={onGenerate}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByText("Промпт")).not.toBeInTheDocument();

    const createButton = screen.getByRole("button", { name: "Создать" });
    expect(createButton).toBeDisabled();

    const file = new File(["ok"], "selfie.jpg", { type: "image/jpeg" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    await user.upload(input as HTMLInputElement, file);

    expect(createButton).toBeEnabled();

    await user.click(createButton);
    expect(onGenerate).toHaveBeenCalledWith(file);
  });

  it("shows validation error for unsupported file type", async () => {
    const user = userEvent.setup({ applyAccept: false });

    const { container } = render(
      <FlowUploadScreen
        isOpen
        selectedStyle={FALLBACK_STYLES[0]}
        prompt="custom"
        aspectRatio="1:1"
        isSubmitting={false}
        onGenerate={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const badFile = new File(["pdf"], "bad.pdf", { type: "application/pdf" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    await user.upload(input as HTMLInputElement, badFile);

    expect(screen.getByText("Поддерживаются только JPG и PNG")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Создать" })).toBeDisabled();
  });
});
