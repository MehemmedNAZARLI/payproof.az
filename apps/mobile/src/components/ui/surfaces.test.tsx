import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Banner } from "./banner";
import { Card, SectionHeader } from "./card";
import { EmptyState } from "./empty-state";

describe("Card and SectionHeader", () => {
  it("renders content and a level-2 section title with its action", () => {
    render(
      <>
        <SectionHeader title="Təsdiq gözləyənlər" action={<button>Hamısı</button>} />
        <Card>Məzmun</Card>
      </>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Təsdiq gözləyənlər" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Hamısı" })).toBeVisible();
    expect(screen.getByText("Məzmun")).toBeVisible();
  });
});

describe("Banner", () => {
  it("states its meaning in text, with an icon and an optional action", () => {
    const { container } = render(
      <Banner tone="danger" title="Təsdiq mümkün deyil" action={<button>Vebdə aç</button>}>
        2 bloklayan problem
      </Banner>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Təsdiq mümkün deyil" })).toBeVisible();
    expect(screen.getByText("2 bloklayan problem")).toBeVisible();
    expect(screen.getByRole("button", { name: "Vebdə aç" })).toBeVisible();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("EmptyState", () => {
  it("explains why the list is empty and offers a way out", () => {
    render(
      <EmptyState
        title="Paket tapılmadı"
        description="Axtarışı və ya filtri dəyişin."
        action={<button>Filtri təmizlə</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "Paket tapılmadı" })).toBeVisible();
    expect(screen.getByText("Axtarışı və ya filtri dəyişin.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Filtri təmizlə" })).toBeVisible();
  });
});
