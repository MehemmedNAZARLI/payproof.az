import { mockIds } from "@payproof/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { packageKeys } from "@/features/packages";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { usePackage } from "../queries";
import { MatchDialog } from "./match-dialog";

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn(), info: vi.fn() } }));

beforeEach(() => {
  setToken(`mock.${mockIds.user("u1")}`);
  vi.stubEnv("NEXT_PUBLIC_API_MOCK", "1");
  toastSuccess.mockClear();
});

function Open({ id, onOpenChange = vi.fn() }: { id: string; onOpenChange?: (o: boolean) => void }) {
  const pkg = usePackage(id).data;
  return pkg ? <MatchDialog pkg={pkg} open onOpenChange={onOpenChange} /> : null;
}

test("INV-1048: confirming without a choice shows an inline error and sends nothing", async () => {
  renderWithQuery(<Open id={mockIds.pkg("pkg_1048")} />);
  const dialog = await screen.findByRole("dialog", {
    name: "INV-1048: sifarişi seçin və təsdiqləyin",
  });
  const options = within(dialog).getByRole("radiogroup", { name: "Sifariş namizədləri" });
  expect(within(options).getAllByRole("radio").length).toBeGreaterThan(1);
  within(options)
    .getAllByRole("radio")
    .forEach((r) => expect(r).not.toBeChecked()); // nothing preselected
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Seçilmiş sifarişlə əlaqəni təsdiqlə" }),
  );
  expect(within(dialog).getByRole("alert")).toHaveTextContent("Sifarişlərdən birini seçin.");
  expect(options).toHaveAttribute("aria-invalid", "true");
  expect(toastSuccess).not.toHaveBeenCalled();
});

test("INV-1042: the confirmed link re-validates the package to NEEDS_FIX", async () => {
  const onOpenChange = vi.fn();
  const { client } = renderWithQuery(
    <Open id={mockIds.pkg("pkg_1042")} onOpenChange={onOpenChange} />,
  );
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByRole("radio", { name: /PO-381/ })).toBeChecked(); // a single candidate is preselected
  expect(
    within(dialog).getByText("Semantik oxşarlıq sübut deyil — əlaqəni insan təsdiqləyir."),
  ).toBeInTheDocument();
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Seçilmiş sifarişlə əlaqəni təsdiqlə" }),
  );
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  expect(toastSuccess).toHaveBeenCalledWith(
    expect.stringMatching(
      /^PO-381 ilə əlaqə təsdiqləndi\. Paket v2 yenidən yoxlandı: Düzəliş tələb edir\.$/,
    ),
  );
  expect(client.getQueryData(packageKeys.detail(mockIds.pkg("pkg_1042")))).toMatchObject({
    status: "NEEDS_FIX",
  });
});

test("no candidates: says so instead of an empty choice that can never be confirmed", async () => {
  const { render } = await import("@testing-library/react");
  const pkg = {
    id: "p1",
    invoice_number: "INV-1051",
    version: 1,
    link: { confirmed: false, candidates: [] },
    fields: [],
    documents: [],
  } as unknown as import("@payproof/api-client").Schemas["PackageDetail"];
  const { QueryClientProvider } = await import("@tanstack/react-query");
  const { testQueryClient } = await import("@/test/render");
  render(
    <QueryClientProvider client={testQueryClient()}>
      <MatchDialog pkg={pkg} open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("Uyğun sifariş namizədi tapılmadı.");
  expect(within(dialog).queryByRole("radiogroup")).toBeNull();
  expect(
    within(dialog).queryByRole("button", { name: "Seçilmiş sifarişlə əlaqəni təsdiqlə" }),
  ).toBeNull();
});
