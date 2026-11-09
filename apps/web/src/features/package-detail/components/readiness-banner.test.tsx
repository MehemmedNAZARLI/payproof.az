import type { Schemas } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { usePackageList } from "@/features/packages";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { usePackage } from "../queries";
import { ReadinessBanner } from "./readiness-banner";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

function FirstWith({
  status,
  onRefresh = vi.fn(),
}: {
  status: Schemas["PackageStatus"];
  onRefresh?: () => void;
}) {
  const id = usePackageList({ status: [status] }).data?.items[0]?.id ?? "";
  const pkg = usePackage(id).data;
  return pkg ? <ReadinessBanner pkg={pkg} onRefresh={onRefresh} /> : null;
}
const banner = (status: Schemas["PackageStatus"]) => {
  renderWithQuery(<FirstWith status={status} />);
  return screen.findByRole("region", { name: /./ });
};

test("NEEDS_FIX: blocked, with the problem count and the check summary", async () => {
  const b = await banner("NEEDS_FIX");
  expect(b).toHaveTextContent(/Paket bloklanıb — \d+ problem həll edilməlidir/);
  expect(b).toHaveTextContent(
    /R-010: cari v\d+ bütün məcburi yoxlamalardan keçməyib \(\d+ keçdi, \d+ uyğunsuz, \d+ naməlum, \d+ tətbiq olunmur\)/,
  );
  expect(b).toHaveClass("bg-danger-bg");
});

test("NEEDS_REVIEW: blocked, warning tone", async () => {
  expect(await banner("NEEDS_REVIEW")).toHaveClass("bg-warning-bg");
});

test("READY_FOR_APPROVAL: waits for a human, readiness is not payment", async () => {
  const b = await banner("READY_FOR_APPROVAL");
  expect(b).toHaveTextContent(
    /Bütün məcburi yoxlamalar v\d+ üzrə keçdi — insan təsdiqi gözlənilir/,
  );
  expect(b).toHaveTextContent("Təsdiq yalnız sənəd paketinin hazırlığına aiddir.");
});

test("APPROVED_READY: amount, approver and the 'not a payment' note", async () => {
  const b = await banner("APPROVED_READY");
  expect(b).toHaveTextContent(/[\d.]+,\d{2} (AZN|USD)-lik faktura paketi göndərilməyə hazırdır/);
  expect(b).toHaveTextContent(
    /Təsdiqləyən: Rəşad Əliyev · .* · v\d+\. Bu, ödənişin təmin edildiyi demək deyil\./,
  );
  expect(b).not.toHaveTextContent("Ödəniş təmin edildi");
});

test("EXPORTED: who exported and when", async () => {
  expect(await banner("EXPORTED")).toHaveTextContent(
    /v\d+ paketi ixrac edilib.*PayProof-dan kənarda izlənir \(P1\)/,
  );
});

test("PROCESSING: nothing is shown before processing ends; a refresh is offered", async () => {
  const onRefresh = vi.fn();
  renderWithQuery(<FirstWith status="PROCESSING" onRefresh={onRefresh} />);
  const b = await screen.findByRole("region", { name: "Sənədlər emal olunur" });
  expect(b).toHaveTextContent("Emal bitməyincə heç bir nəticə göstərilmir.");
  await userEvent.click(screen.getByRole("button", { name: "Emal vəziyyətini yenilə" }));
  expect(onRefresh).toHaveBeenCalledOnce();
});

const crafted = (p: Partial<Schemas["PackageDetail"]>) =>
  ({
    version: 3,
    approvals: [],
    exports: [],
    summary: { blocking: [] },
    total: null,
    current_approval: null,
    ...p,
  }) as unknown as Schemas["PackageDetail"];
const approval = (v: number, at: string, valid = false) =>
  ({
    package_version: v,
    approved_at: at,
    valid,
    approver: { full_name: "Rəşad Əliyev" },
  }) as Schemas["ApprovalRecord"];

test("the invalidated approval mentioned is the latest by time, whatever the list order", () => {
  renderWithQuery(
    <ReadinessBanner
      onRefresh={vi.fn()}
      pkg={crafted({
        status: "READY_FOR_APPROVAL",
        approvals: [approval(2, "2026-11-05T10:00:00Z"), approval(1, "2026-11-01T10:00:00Z")],
      })}
    />,
  );
  expect(screen.getByRole("region")).toHaveTextContent("Əvvəlki v2 təsdiqi etibarsızlaşıb");
});

test("EXPORTED without an export of the current version names no exporter", () => {
  renderWithQuery(
    <ReadinessBanner
      onRefresh={vi.fn()}
      pkg={crafted({
        status: "EXPORTED",
        exports: [
          {
            package_version: 1,
            created_at: "2026-11-01T10:00:00Z",
            created_by: { full_name: "Aygün Məmmədova" },
          },
        ] as Schemas["ExportRecord"][],
      })}
    />,
  );
  const b = screen.getByRole("region");
  expect(b).toHaveTextContent("v3 paketi ixrac edilib");
  expect(b).not.toHaveTextContent("Aygün Məmmədova");
});
