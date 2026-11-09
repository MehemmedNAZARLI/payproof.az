import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Banner } from "./banner";
import { Card, SectionHeader } from "./card";
import { EmptyState } from "./empty-state";

describe("Card and SectionHeader", () => {
  it("renders content and a level-2 section title with its action", () => {
    render(
      <>
        <SectionHeader title="Awaiting approval" action={<button>All</button>} />
        <Card>Məzmun</Card>
      </>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Awaiting approval" })).toBeVisible();
    expect(screen.getByRole("button", { name: "All" })).toBeVisible();
    expect(screen.getByText("Məzmun")).toBeVisible();
  });
});

describe("Banner", () => {
  it("states its meaning in text, with an icon and an optional action", () => {
    const { container } = render(
      <Banner tone="danger" title="Approval unavailable" action={<button>Open on web</button>}>
        2 issues problem
      </Banner>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Approval unavailable" })).toBeVisible();
    expect(screen.getByText("2 issues problem")).toBeVisible();
    expect(screen.getByRole("button", { name: "Open on web" })).toBeVisible();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("EmptyState", () => {
  it("explains why the list is empty and offers a way out", () => {
    render(
      <EmptyState
        title="Package not found"
        description="Try a different search or filter."
        action={<button>Clear filters</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Package not found" })).toBeVisible();
    expect(screen.getByText("Try a different search or filter.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeVisible();
  });
});
