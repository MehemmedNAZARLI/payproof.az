import type { Schemas } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { usePackage } from "../queries";
import { MatchBanner } from "./match-banner";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

function Of({ id }: { id: string }) {
  const pkg = usePackage(id).data;
  return pkg ? <MatchBanner onReview={() => {}} pkg={pkg} /> : <p>…</p>;
}

test("INV-1042: an unconfirmed AI suggestion names its candidate(s) and says a human decides", async () => {
  renderWithQuery(<Of id={mockIds.pkg("pkg_1042")} />);
  const b = await screen.findByRole("region", {
    name: /Sifariş uyğunlaşdırması təsdiq gözləyir|mümkün sifariş tapıldı/,
  });
  expect(b).toHaveTextContent(/PO-\d+: /);
  expect(b).toHaveTextContent("Semantik oxşarlıq sübut deyil — əlaqəni insan təsdiqləyir.");
  expect(screen.getByRole("button", { name: "Bax və təsdiqlə" })).toBeEnabled();
});

const pkg = (
  link: Partial<Schemas["OrderLink"]>,
  status: Schemas["PackageStatus"] = "NEEDS_REVIEW",
) =>
  ({
    status,
    link: { confirmed: false, candidates: [], ...link },
  }) as unknown as Schemas["PackageDetail"];
const cand = (po_number: string) =>
  ({ po_number, reason: "Alıcı eynidir" }) as Schemas["MatchCandidate"];

test("several candidates → a choice is required", () => {
  render(
    <MatchBanner onReview={() => {}} pkg={pkg({ candidates: [cand("PO-1"), cand("PO-2")] })} />,
  );
  expect(
    screen.getByRole("region", { name: "2 mümkün sifariş tapıldı — seçim tələb olunur" }),
  ).toBeInTheDocument();
});

test("nothing to show once confirmed, or while processing", () => {
  const { container, rerender } = render(
    <MatchBanner onReview={() => {}} pkg={pkg({ confirmed: true })} />,
  );
  expect(container).toBeEmptyDOMElement();
  rerender(<MatchBanner onReview={() => {}} pkg={pkg({}, "PROCESSING")} />);
  expect(container).toBeEmptyDOMElement();
});
