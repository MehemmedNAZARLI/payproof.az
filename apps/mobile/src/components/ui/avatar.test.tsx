import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar, avatarTone, initials } from "./avatar";

describe("Avatar", () => {
  it("shows the first letters of the first two names, Azerbaijani-aware", () => {
    expect(initials("Rəşad Əliyev")).toBe("RƏ");
    expect(initials("ilkin  ismayılov qızı")).toBe("İİ");
  });

  it("gives a user the same tone every time", () => {
    const id = "0193a000-0000-7000-8000-000000000002";
    expect(avatarTone(id)).toBe(avatarTone(id));
    expect(avatarTone(id)).toBeGreaterThanOrEqual(0);
    expect(avatarTone(id)).toBeLessThan(5);
  });

  it("is hidden from screen readers and marks the system without initials", () => {
    const { container } = render(<Avatar user={null} />);
    const el = container.firstElementChild;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el?.textContent).toBe("");
    expect(el?.querySelector("svg")).not.toBeNull();
  });
});
