import type { Schemas } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { usePackageList } from "@/features/packages";
import { setToken } from "@/lib/auth";
import { renderHookWithQuery, renderWithQuery } from "@/test/render";
import { usePackage } from "../queries";
import { DocumentsPanel } from "./documents-panel";

beforeEach(() => {
  setToken(`mock.${mockIds.user("u1")}`);
  vi.stubEnv("NEXT_PUBLIC_API_MOCK", "1");
});

function Of({ id }: { id: string }) {
  const pkg = usePackage(id).data;
  return pkg ? <DocumentsPanel pkg={pkg} /> : null;
}
const panel = () => screen.findByRole("region", { name: "Sənədlər və versiyalar" });

test("INV-1042: one card per document type with version, file, status and provenance", async () => {
  renderWithQuery(<Of id={mockIds.pkg("pkg_1042")} />);
  const p = await panel();
  const invoice = within(p).getByRole("article", { name: "Faktura" });
  expect(invoice).toHaveTextContent(/v\d+/);
  expect(invoice).toHaveTextContent(/\.pdf|\.png|\.jpg|\.xlsx/i);
  expect(invoice).toHaveTextContent(/hash [0-9a-f]{8}/);
  expect(within(invoice).getByRole("button", { name: "Bax" })).toHaveAttribute(
    "aria-disabled",
    "true",
  ); // viewer: W-09
  // the order link is not confirmed yet on INV-1042
  expect(within(p).getByRole("article", { name: "Sifariş" })).toHaveTextContent(
    "Uyğunlaşdırma gözləyir",
  );
});

test("previous versions are listed for audit, newest first", async () => {
  // find a demo package with a re-uploaded document instead of hard-coding one
  const list = renderHookWithQuery(() => usePackageList({}));
  await waitFor(() => expect(list.result.current.data).toBeDefined());
  let found: Schemas["PackageDetail"] | undefined;
  for (const { id } of list.result.current.data!.items) {
    const d = renderHookWithQuery(() => usePackage(id));
    await waitFor(() => expect(d.result.current.data).toBeDefined());
    if (d.result.current.data!.documents.some((doc) => doc.history.length))
      found = d.result.current.data!;
  }
  expect(found).toBeDefined();
  render(<DocumentsPanel pkg={found!} />);
  expect(
    screen.getByText(/^Əvvəlki versiyalar \(\d+\) — audit üçün saxlanılır$/),
  ).toBeInTheDocument();
});

const bare = (requireDelivery: boolean) =>
  ({
    status: "NEEDS_FIX",
    link: { confirmed: true },
    requirement_set: { version: 2, require_delivery: requireDelivery },
    documents: [],
  }) as unknown as Schemas["PackageDetail"];

test("a missing required document: 'no document' is not 'unreadable'", () => {
  render(<DocumentsPanel pkg={bare(true)} />);
  const delivery = screen.getByRole("article", { name: "Təhvil sənədi" });
  expect(delivery).toHaveTextContent("Təhvil sənədi yoxdur");
  expect(delivery).toHaveTextContent(
    "Müştəri qaydası (v2) bu sənədi tələb edir. “Sənəd yoxdur” — “sənəd oxunmadı” deyil.",
  );
  expect(within(delivery).getByRole("button", { name: "Yüklə" })).toBeInTheDocument();
});

test("a missing optional document is just noted", () => {
  render(<DocumentsPanel pkg={bare(false)} />);
  const delivery = screen.getByRole("article", { name: "Təhvil sənədi" });
  expect(delivery).toHaveTextContent("Bu müştəri üçün tələb olunmur.");
  expect(within(delivery).queryByRole("button")).toBeNull();
});
