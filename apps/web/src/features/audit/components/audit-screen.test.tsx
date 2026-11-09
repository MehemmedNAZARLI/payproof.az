import { mockIds } from "@payproof/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { AuditScreen } from "./audit-screen";

const nav = vi.hoisted(() => ({ search: "", push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
}));
const saveFile = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/lib/download", () => ({ saveFile }));

beforeEach(() => {
  setToken(`mock.${mockIds.user("u5")}`);
  nav.search = "";
  [nav.push, nav.replace, saveFile].forEach((f) => f.mockClear());
});
const rows = async () =>
  within(await screen.findByRole("table", { name: "Audit hadisələri" }))
    .getAllByRole("row")
    .slice(1);

test("events with time, actor (or Sistem), message and a linked package version", async () => {
  renderWithQuery(<AuditScreen />);
  const all = await rows();
  expect(all.length).toBeGreaterThan(0);
  const linked = screen.getAllByRole("link", { name: /^INV-\d+$/ })[0]!;
  expect(linked).toHaveAttribute("href", expect.stringMatching(/^\/packages\/[0-9a-f-]{36}$/));
  expect(screen.getAllByText(/^v\d+$/).length).toBeGreaterThan(0);
  expect(screen.getByText(/append-only jurnal, redaktə edilmir/)).toBeInTheDocument();
});

test("the URL filter narrows the log; changing the user goes to the URL", async () => {
  nav.search = "actor=system";
  renderWithQuery(<AuditScreen />);
  for (const r of await rows())
    expect(within(r).getAllByRole("cell")[1]).toHaveTextContent("Sistem");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "İstifadəçi" }), "");
  expect(nav.push).toHaveBeenLastCalledWith("/audit", { scroll: false });
});

test("search replaces the URL entry; CSV downloads the filtered log", async () => {
  renderWithQuery(<AuditScreen />);
  await rows();
  await userEvent.type(screen.getByRole("searchbox", { name: "Auditdə axtar" }), "INV-1036");
  await waitFor(() =>
    expect(nav.replace).toHaveBeenLastCalledWith("/audit?q=INV-1036", { scroll: false }),
  );
  await userEvent.click(screen.getByRole("button", { name: "CSV yüklə" }));
  await waitFor(() =>
    expect(saveFile).toHaveBeenCalledWith("PayProof_audit.csv", expect.any(Blob)),
  );
});
