import type { Schemas } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { EvidenceViewer } from "./evidence-viewer";
import { PackageDetailScreen } from "./package-detail-screen";

beforeEach(() => {
  setToken(`mock.${mockIds.user("u1")}`);
  vi.stubEnv("NEXT_PUBLIC_API_MOCK", "1");
});

test("INV-1044: the price cell's source opens on the cited line, focus returns afterwards", async () => {
  renderWithQuery(<PackageDetailScreen id={mockIds.pkg("pkg_1044")} />);
  const open = await screen.findByRole("button", {
    name: "Mənbəyə bax: KY-10 Vahid qiymət (Faktura)",
  });
  await userEvent.click(open);
  const dialog = await screen.findByRole("dialog", { name: /^Faktura · .+ · v1$/ });
  expect(dialog).toHaveAccessibleDescription("Səhifə 1 · KY-10 Vahid qiymət");
  const quote = "Kərə yağı 82%, 10 kq blok — 50 blok × 110,00";
  expect(within(dialog).getByRole("blockquote")).toHaveTextContent(quote);
  expect(within(dialog).getByRole("mark")).toHaveTextContent(quote); // highlighted on the paper
  expect(dialog).toHaveTextContent("Vurğulama koordinatı yoxdur — səhifə və sitat göstərilir.");
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(open).toHaveFocus();
});

const version = (id: string, n: number, source_kind: "pdf" | "scan" = "pdf") =>
  ({
    id,
    version_no: n,
    file_name: `INV-1047_v${n}.pdf`,
    source_kind,
  }) as Schemas["DocumentVersion"];
const pkg = (current: Schemas["DocumentVersion"], history: Schemas["DocumentVersion"][] = []) =>
  ({
    customer: { name: "C Restoran Qrupu" },
    documents: [{ id: "d1", type: "invoice", current, history }],
    fields: [],
  }) as unknown as Schemas["PackageDetail"];
const evidence = (document_version_id: string) => ({
  document_version_id,
  page: 2,
  quote: "Sifariş №: PO-3?7",
  bbox: null,
});

test("evidence from an older version and from a scan is flagged", () => {
  render(
    <EvidenceViewer
      pkg={pkg(version("v2", 2, "scan"), [version("v1", 1, "scan")])}
      evidence={evidence("v1")}
      label="PO"
      onClose={vi.fn()}
    />,
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("Köhnə versiya: bu sübut v1-dəndir, cari versiya v2-dir.");
  expect(dialog).toHaveTextContent(
    "Skan sənəd: mətn OCR ilə oxunub — dəyəri mənbə ilə müqayisə edin.",
  );
  expect(dialog).toHaveAccessibleDescription("Səhifə 2 · PO");
});

test("evidence pointing at an unknown version still opens a titled dialog with the quote", () => {
  render(
    <EvidenceViewer
      pkg={pkg(version("v2", 2))}
      evidence={evidence("gone")}
      label="PO"
      onClose={vi.fn()}
    />,
  );
  const dialog = screen.getByRole("dialog", { name: "Mənbə sənəd tapılmadı" });
  expect(dialog).toHaveTextContent("Sifariş №: PO-3?7");
  expect(screen.getByRole("button", { name: "Bağla" })).toBeInTheDocument();
});

test("signature review (R-008): visual presence only, confirmed by a person", async () => {
  const onConfirm = vi.fn();
  const { default: userEvent } = await import("@testing-library/user-event");
  render(
    <EvidenceViewer
      pkg={pkg(version("v2", 2))}
      evidence={{ ...evidence("v2"), quote: "Qəbul edənin imzası və möhürü: doldurulub" }}
      label="İmza"
      onClose={vi.fn()}
      signature={{ onConfirm, pending: false }}
    />,
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("İmza tələbi (R-008)");
  expect(dialog).toHaveTextContent("hüquqi autentifikasiya deyil");
  await userEvent.click(screen.getByRole("button", { name: "İmzanın mövcudluğunu təsdiqləyirəm" }));
  expect(onConfirm).toHaveBeenCalledOnce();
});
