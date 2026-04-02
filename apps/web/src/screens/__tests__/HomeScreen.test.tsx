import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FALLBACK_STYLES } from "../../data/styles";
import { HomeScreen } from "../HomeScreen";

describe("HomeScreen", () => {
  it("shows all styles in 'ВСЕ' and filters by selected category", async () => {
    const user = userEvent.setup();
    const onPreviewStyle = vi.fn();

    render(<HomeScreen styles={FALLBACK_STYLES} photos={[]} onPreviewStyle={onPreviewStyle} />);

    expect(screen.getByRole("button", { name: "ВСЕ" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: /Голливуд/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Аниме/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Бизнес и карьера" }));

    expect(screen.getByRole("button", { name: /Бизнес-портрет/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Аниме/ })).not.toBeInTheDocument();
  });

  it("calls onPreviewStyle when style card is clicked", async () => {
    const user = userEvent.setup();
    const onPreviewStyle = vi.fn();

    render(<HomeScreen styles={FALLBACK_STYLES} photos={[]} onPreviewStyle={onPreviewStyle} />);

    await user.click(screen.getAllByRole("button", { name: /Голливуд/ })[0]);

    expect(onPreviewStyle).toHaveBeenCalledTimes(1);
    expect(onPreviewStyle).toHaveBeenCalledWith(
      expect.objectContaining({ id: "hollywood", name: "Голливуд" }),
    );
  });
});
