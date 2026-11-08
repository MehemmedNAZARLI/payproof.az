import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Icon } from "./icon";

describe("Icon", () => {
  it("is decorative and hidden from assistive tech", () => {
    const { container } = render(<Icon name="bell" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("draws the named glyph at the requested size", () => {
    const { container } = render(<Icon name="check" size={28} />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "28");
    expect(container.querySelector("path")).toHaveAttribute("d", "M20 6 9 17l-5-5");
  });
});
