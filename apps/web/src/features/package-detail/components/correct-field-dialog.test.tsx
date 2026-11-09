import { mockIds } from "@payproof/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { usePackage } from "../queries";
import { CorrectFieldDialog } from "./correct-field-dialog";

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn(), info: vi.fn() } }));
beforeEach(() => {
  setToken(`mock.${mockIds.user("u1")}`);
  vi.stubEnv("NEXT_PUBLIC_API_MOCK", "1");
  toastSuccess.mockClear();
});

function Open({
  path,
  onOpenChange = vi.fn(),
  onUploadInstead = vi.fn(),
}: {
  path: string;
  onOpenChange?: (o: boolean) => void;
  onUploadInstead?: () => void;
}) {
  const pkg = usePackage(mockIds.pkg("pkg_1047")).data;
  const field = pkg?.fields.find((f) => f.field_path === path);
  return pkg && field ? (
    <CorrectFieldDialog
      pkg={pkg}
      field={field}
      open
      onOpenChange={onOpenChange}
      onUploadInstead={onUploadInstead}
    />
  ) : null;
}

test("INV-1047: the unreadable PO is corrected from the source → READY", async () => {
  const onOpenChange = vi.fn();
  renderWithQuery(<Open path="invoice.po_ref" onOpenChange={onOpenChange} />);
  const dialog = await screen.findByRole("dialog", { name: "Çıxarışı düzəlt: Sifariş № (PO)" });
  expect(dialog).toHaveTextContent("Oxunan dəyər: PO-3?7");
  expect(within(dialog).getByRole("mark")).toHaveTextContent("PO-3?7"); // the source is right there

  await userEvent.click(within(dialog).getByRole("button", { name: "Düzəlişi yadda saxla" }));
  expect(within(dialog).getByText("Yeni dəyəri yazın.")).toBeInTheDocument();
  expect(within(dialog).getByText("Səbəb ən azı 3 simvol olmalıdır.")).toBeInTheDocument();

  await userEvent.type(within(dialog).getByRole("textbox", { name: "Yeni dəyər" }), "PO-397");
  await userEvent.type(
    within(dialog).getByRole("textbox", { name: "Səbəb" }),
    "Skanda rəqəm 9-dur",
  );
  await userEvent.click(within(dialog).getByRole("button", { name: "Düzəlişi yadda saxla" }));
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  expect(toastSuccess).toHaveBeenCalledWith(
    expect.stringMatching(
      /^Sifariş № \(PO\) düzəldildi\. Paket v\d+ yenidən yoxlandı: Təsdiq gözləyir\.$/,
    ),
  );
});

test("a price must be a decimal amount", async () => {
  renderWithQuery(<Open path="invoice.lines[GY-1L].unit_price" />);
  const dialog = await screen.findByRole("dialog");
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Yeni dəyər" }), "9,1x");
  await userEvent.click(within(dialog).getByRole("button", { name: "Düzəlişi yadda saxla" }));
  expect(within(dialog).getByText("Məbləği nöqtə ilə yazın, məsələn 9.10.")).toBeInTheDocument();
});

test("the other way — the document itself is wrong — is offered", async () => {
  const onUploadInstead = vi.fn();
  renderWithQuery(<Open path="invoice.po_ref" onUploadInstead={onUploadInstead} />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Bunun əvəzinə yeni versiya yükləyin" }),
  );
  expect(onUploadInstead).toHaveBeenCalledOnce();
});
