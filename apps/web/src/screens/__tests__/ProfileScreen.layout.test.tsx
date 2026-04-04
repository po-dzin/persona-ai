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

    const header = container.querySelector(".profile-header");
    expect(header).toBeTruthy();
    expect(header?.children).toHaveLength(3);
    expect(header?.children[0]).toHaveTextContent("А");
    expect(header?.children[1]).toHaveTextContent("Алексей");
    expect(header?.children[2]).toHaveTextContent("@alexey");
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
    const docsTitle = screen.getByText("Документы");
    const cards = container.querySelectorAll(".profile-card");
    const tail = container.querySelector(".screen-tail-space");

    expect(socialTitle).toBeInTheDocument();
    expect(supportTitle).toBeInTheDocument();
    expect(docsTitle).toBeInTheDocument();
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Instagram");
    expect(cards[0]).toHaveTextContent("Telegram канал");
    expect(cards[1]).toHaveTextContent("Поддержка");
    expect(cards[2]).toHaveTextContent("Политика конфиденциальности");
    expect(cards[2]).toHaveTextContent("Пользовательское соглашение");
    expect(cards[2]).toHaveTextContent("Политика обработки платежей");
    expect(cards[2]).toHaveTextContent("Отказ от ответственности");
    expect(cards[0].querySelectorAll(".profile-row")).toHaveLength(2);
    expect(cards[1].querySelectorAll(".profile-row")).toHaveLength(1);
    expect(cards[2].querySelectorAll(".profile-row")).toHaveLength(4);
    expect(socialTitle.nextElementSibling).toBe(cards[0]);
    expect(supportTitle.nextElementSibling).toBe(cards[1]);
    expect(docsTitle.nextElementSibling).toBe(cards[2]);
    expect(cards[2].nextElementSibling).toBe(tail);
    expect(container.firstElementChild?.lastElementChild).toHaveClass("screen-tail-space");
  });
});
