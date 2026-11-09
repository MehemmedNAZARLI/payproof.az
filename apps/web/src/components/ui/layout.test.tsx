import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Banner, EmptyState, PageHeader, Panel } from "./layout";

test("PageHeader: one h1, description and actions", () => {
  render(
    <PageHeader
      title="Faktura paketləri"
      description="Hər paket bir fakturanı…"
      actions={<button>Yeni paket</button>}
    />,
  );
  expect(screen.getByRole("heading", { level: 1, name: "Faktura paketləri" })).toBeInTheDocument();
  expect(screen.getByText("Hər paket bir fakturanı…")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Yeni paket" })).toBeInTheDocument();
});

test("Panel with a title is a region named by its heading", () => {
  render(
    <Panel title="Yoxlamalar" actions={<button>Hamısı</button>}>
      məzmun
    </Panel>,
  );
  const region = screen.getByRole("region", { name: "Yoxlamalar" });
  expect(region).toHaveTextContent("məzmun");
  expect(screen.getByRole("heading", { level: 2, name: "Yoxlamalar" })).toBeInTheDocument();
});

describe("Banner", () => {
  test.each([
    ["danger", "bg-danger-bg"],
    ["warning", "bg-warning-bg"],
    ["success", "bg-success-bg"],
    ["brand", "bg-brand-50"],
    ["neutral", "bg-surface-2"],
  ] as const)("%s tone", (tone, bg) => {
    const { container } = render(
      <Banner tone={tone} title="Başlıq">
        izah
      </Banner>,
    );
    const banner = container.firstElementChild!;
    expect(banner).toHaveClass(bg);
    // the icon only decorates: title and text carry the message
    expect(banner.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(banner).toHaveTextContent("Başlıqizah");
    // not a section: no heading, so the page outline stays h1 → h2
    expect(screen.queryByRole("heading")).toBeNull();
  });

  test("urgent banners can be announced", () => {
    render(
      <Banner tone="danger" title="Təsdiq bloklanıb" role="alert" actions={<button>Bax</button>} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Təsdiq bloklanıb");
    expect(screen.getByRole("button", { name: "Bax" })).toBeInTheDocument();
  });
});

test("EmptyState: heading, text and an optional action", () => {
  render(
    <EmptyState
      title="Filtrə uyğun nəticə yoxdur"
      description="Filtrləri dəyişin."
      action={<button>Filtrləri təmizlə</button>}
    />,
  );
  expect(
    screen.getByRole("heading", { level: 2, name: "Filtrə uyğun nəticə yoxdur" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Filtrləri təmizlə" })).toBeInTheDocument();
});

test("EmptyState inside a Panel uses h3", () => {
  render(
    <Panel title="Sənədlər">
      <EmptyState headingLevel={3} title="Sənəd yoxdur" />
    </Panel>,
  );
  expect(screen.getByRole("heading", { level: 3, name: "Sənəd yoxdur" })).toBeInTheDocument();
});
