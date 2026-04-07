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
    const legalToggle = screen.getByRole("button", { name: /Условия и политика/i });
    const cards = container.querySelectorAll(".profile-card");
    const tail = container.querySelector(".screen-tail-space");

    expect(socialTitle).toBeInTheDocument();
    expect(supportTitle).toBeInTheDocument();
    expect(legalToggle).toBeInTheDocument();
    expect(legalToggle).toHaveAttribute("aria-expanded", "false");
    // no isAdmin → 2 cards (social, support)
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Instagram");
    expect(cards[0]).toHaveTextContent("Telegram канал");
    expect(cards[1]).toHaveTextContent("Поддержка");
    expect(screen.queryByText("Политика конфиденциальности")).not.toBeInTheDocument();
    expect(screen.queryByText("Пользовательское соглашение")).not.toBeInTheDocument();
    expect(screen.queryByText("Политика обработки платежей")).not.toBeInTheDocument();
    expect(screen.queryByText("Отказ от ответственности")).not.toBeInTheDocument();
    expect(cards[0].querySelectorAll(".profile-row")).toHaveLength(2);
    expect(cards[1].querySelectorAll(".profile-row")).toHaveLength(1);
    expect(socialTitle.nextElementSibling).toBe(cards[0]);
    expect(supportTitle.nextElementSibling).toBe(cards[1]);
    expect(legalToggle.nextElementSibling).toBe(tail);
    expect(container.firstElementChild?.lastElementChild).toHaveClass("screen-tail-space");
    // admin section must be absent for non-admin users
    expect(screen.queryByText("Admin Panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Администрирование")).not.toBeInTheDocument();
  });

  it("shows admin section only when isAdmin=true", () => {
    const { container } = render(
      <ProfileScreen
        credits={500}
        generations={10}
        firstName="Глеб"
        isAdmin={true}
        tgInitData="query_id=AAA&user=%7B%22id%22%3A574824008%7D&hash=abc"
      />,
    );

    // Admin section title + card are present
    expect(screen.getByText("Администрирование")).toBeInTheDocument();
    expect(screen.getByText("Admin Panel")).toBeInTheDocument();
    expect(screen.getByText("Статистика и управление")).toBeInTheDocument();

    // Admin card is the first .profile-card; social + support follow
    const cards = container.querySelectorAll(".profile-card");
    expect(cards).toHaveLength(3); // admin, social, support

    const adminCard = cards[0];
    expect(adminCard.querySelector("a")).toHaveAttribute("href");
    expect(adminCard.querySelector("a")?.getAttribute("href")).toContain("/admin");
    expect(adminCard.querySelector("a")?.getAttribute("href")).toContain("tgInitData=");

    // Social and support are still present
    expect(screen.getByText("Мы в соцсетях")).toBeInTheDocument();
    expect(screen.getByText("Помощь")).toBeInTheDocument();
  });

  it("hides admin section when isAdmin=false", () => {
    render(
      <ProfileScreen
        credits={100}
        generations={5}
        firstName="Иван"
        isAdmin={false}
      />,
    );
    expect(screen.queryByText("Admin Panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Администрирование")).not.toBeInTheDocument();
  });
});
