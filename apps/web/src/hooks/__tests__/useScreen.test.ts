import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useScreen } from "../useScreen";

describe("useScreen", () => {
  it("uses home when storage is empty and persists selected screen", () => {
    const { result } = renderHook(() => useScreen());

    expect(result.current.activeScreen).toBe("home");

    act(() => {
      result.current.setActiveScreen("balance");
    });

    expect(localStorage.getItem("persona_last_screen")).toBe("balance");
  });

  it("restores valid screen from localStorage", () => {
    localStorage.setItem("persona_last_screen", "profile");

    const { result } = renderHook(() => useScreen());

    expect(result.current.activeScreen).toBe("profile");
  });

  it("ignores invalid screen value in localStorage", () => {
    localStorage.setItem("persona_last_screen", "invalid-screen");

    const { result } = renderHook(() => useScreen());

    expect(result.current.activeScreen).toBe("home");
  });
});
