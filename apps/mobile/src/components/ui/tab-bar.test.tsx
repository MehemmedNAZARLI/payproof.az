import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IconButton } from "./icon-button";
import { TabBar } from "./tab-bar";

const nav = vi.hoisted(() => ({ pathname: "/home" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

describe("TabBar", () => {
  beforeEach(() => {
    nav.pathname = "/home";
  });

  it("lists the four sections in order", () => {
    render(<TabBar />);
    const bar = screen.getByRole("navigation", { name: "Mobile navigation" });
    const names = [...bar.querySelectorAll("a")].map((a) => a.textContent);
    expect(names).toEqual(["Home", "Packages", "Notifications", "Profile"]);
  });

  it("marks the current section, including its detail pages", () => {
    nav.pathname = "/packages/pkg_1038";
    render(<TabBar />);
    expect(screen.getByRole("link", { name: "Packages" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("announces the unread count on the notifications tab", () => {
    render(<TabBar notificationCount={3} />);
    expect(screen.getByRole("link", { name: "Notifications, 3 unread" })).toBeVisible();
  });

  it("caps a large count", () => {
    render(<TabBar notificationCount={150} />);
    expect(screen.getByText("99+")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("IconButton", () => {
  it("has an accessible name and fires its action", () => {
    const onClick = vi.fn();
    render(<IconButton icon="refresh" label="Siyahını yenilə" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Siyahını yenilə" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
