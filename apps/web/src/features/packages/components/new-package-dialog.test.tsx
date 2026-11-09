import { mockIds } from "@payproof/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { NewPackageDialog } from "./new-package-dialog";

// multipart cannot run in jsdom (see new-package.test.ts): the requests are stubbed here
const req = vi.hoisted(() => ({ create: vi.fn(), wait: vi.fn(), follow: vi.fn() }));
vi.mock("../new-package", async (orig) => ({
  ...(await orig<typeof import("../new-package")>()),
  createPackageRequest: req.create,
  waitForJob: req.wait,
  follow: req.follow,
}));
const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));

beforeEach(() => {
  setToken(`mock.${mockIds.user("u1")}`);
  vi.stubEnv("NEXT_PUBLIC_API_MOCK", "1");
  Object.values(req).forEach((f) => f.mockReset());
  nav.push.mockReset();
});
const open = () => {
  const onOpenChange = vi.fn();
  renderWithQuery(<NewPackageDialog open onOpenChange={onOpenChange} />);
  return onOpenChange;
};
const submit = () =>
  userEvent.click(screen.getByRole("button", { name: "Paketi yarat və emal et" }));

test("customer and invoice are required; nothing is sent", async () => {
  open();
  await submit();
  expect(screen.getByText("Müştərini seçin.")).toBeInTheDocument();
  expect(screen.getByText("Faktura faylı məcburidir.")).toBeInTheDocument();
  expect(req.create).not.toHaveBeenCalled();
});

test("a demo set picks its customer and files; creating goes to the new package", async () => {
  req.create.mockResolvedValue({ job_id: "j1", package_id: "p1" });
  const onOpenChange = open();
  await waitFor(() =>
    expect(screen.getByLabelText("Müştəri")).toHaveTextContent(/C Restoran Qrupu/),
  );
  await userEvent.click(screen.getByRole("radio", { name: /INV-1051/ }));
  expect(screen.getByLabelText("Müştəri")).toHaveDisplayValue("C Restoran Qrupu");
  await waitFor(() => expect(screen.getByLabelText("Məsul şəxs")).toHaveDisplayValue(/Aygün/));
  await submit();
  await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/packages/p1"));
  const [input] = req.create.mock.calls[0]!;
  expect(input).toMatchObject({ customerId: mockIds.customer("c2"), ownerId: mockIds.user("u1") });
  expect(Object.keys(input.files)).toEqual(["invoice", "order", "delivery"]);
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(req.follow).toHaveBeenCalledWith(expect.anything(), "j1", "p1", "INV-1051");
});

test("a duplicate invoice is explained in the dialog; no package, no navigation", async () => {
  req.create.mockResolvedValue({ job_id: "j2" });
  req.wait.mockResolvedValue({
    status: "FAILED",
    error: { code: "DUPLICATE_INVOICE", message: "INV-1052 bu müştəri üçün artıq mövcuddur." },
  });
  open();
  await waitFor(() => expect(screen.getByLabelText("Müştəri")).toHaveTextContent(/B Mağazalar/));
  await userEvent.click(screen.getByRole("radio", { name: /INV-1052/ }));
  await submit();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "INV-1052 bu müştəri üçün artıq mövcuddur.",
  );
  expect(nav.push).not.toHaveBeenCalled();
});
