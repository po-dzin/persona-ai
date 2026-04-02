import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfileScreen } from "../ProfileScreen";

describe("ProfileScreen layout", () => {
  it("keeps the header, stats, and card stack order intact", () => {
    const { container } = render(
      <ProfileScreen
        credits={1200}
        generations={47}
        firstName="Алексей"
        username="alexey"
      />,
    );

    expect(container.firstElementChild).toHaveClass("screen");

    const header = container.querySelector(".profile-header");
    expect(header).toBeTruthy();
    expect(header?.children[0]).toHaveClass("profile-avatar");
    expect(header?.children[1]).toHaveClass("profile-name");
    expect(header?.children[2]).toHaveClass("profile-username");
    expect(screen.getByText("Алексей")).toBeInTheDocument();
    expect(screen.getByText("@alexey")).toBeInTheDocument();

    const stats = container.querySelector(".profile-stats");
    expect(stats?.children).toHaveLength(2);
    expect(screen.getByText("47")).toBeInTheDocument();
    expect(screen.getByText("Генераций")).toBeInTheDocument();
    expect(screen.getByText("1200")).toBeInTheDocument();
    expect(screen.getByText("Монет")).toBeInTheDocument();
    expect(stats?.children[0]).toHaveTextContent("47");
    expect(stats?.children[1]).toHaveTextContent("1200");

    const socialTitle = screen.getByText("Мы в соцсетях");
    const supportTitle = screen.getByText("Помощь");
    const cards = container.querySelectorAll(".profile-card");
    const tail = container.querySelector(".screen-tail-space");

    expect(socialTitle).toBeInTheDocument();
    expect(supportTitle).toBeInTheDocument();
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelectorAll(".profile-row")).toHaveLength(2);
    expect(cards[1].querySelectorAll(".profile-row")).toHaveLength(1);
    expect(socialTitle.nextElementSibling).toBe(cards[0]);
    expect(supportTitle.nextElementSibling).toBe(cards[1]);
    expect(cards[1].nextElementSibling).toBe(tail);
    expect(container.firstElementChild?.lastElementChild).toHaveClass("screen-tail-space");
  });
});
