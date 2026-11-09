import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListGroup, ListItem } from "./list";
import { ListSkeleton } from "./skeleton";

describe("ListGroup and ListItem", () => {
  it("renders a labelled list of link rows with a chevron", () => {
    render(
      <ListGroup label="Packages" variant="cards">
        <ListItem href="/packages/1" title="INV-1038" subtitle="B Mağazalar Şəbəkəsi · v1" />
      </ListGroup>,
    );
    const list = screen.getByRole("list", { name: "Packages" });
    expect(list.querySelectorAll("li")).toHaveLength(1);
    const link = screen.getByRole("link", { name: /INV-1038/ });
    expect(link).toHaveAttribute("href", "/packages/1");
    expect(link.querySelector("svg")).not.toBeNull();
  });

  it("makes a row a button when it has an action", () => {
    const onClick = vi.fn();
    render(
      <ListGroup>
        <ListItem title="R-001" subtitle="Passed" onClick={onClick} />
      </ListGroup>,
    );
    fireEvent.click(screen.getByRole("button", { name: /R-001/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("keeps static rows non-interactive and without a chevron", () => {
    render(
      <ListGroup>
        <ListItem title="Package version" trailing="v3" />
      </ListGroup>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("listitem").querySelector("svg")).toBeNull();
  });
});

describe("ListSkeleton", () => {
  it("announces loading once and hides the placeholder blocks", () => {
    const { container } = render(<ListSkeleton rows={3} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(container.querySelectorAll('[aria-hidden="true"].shimmer')).toHaveLength(9);
  });
});
