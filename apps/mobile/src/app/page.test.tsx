import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("renders the large title as the page heading", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: "PayProof" })).toBeInTheDocument();
  });
});
