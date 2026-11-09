import { unwrap } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { ExportDialog } from "./export-dialog";

const saveFile = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("../approval", async (orig) => ({
  ...(await orig<typeof import("../approval")>()),
  saveFile,
}));
beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));
const detail = () =>
  unwrap(
    api.GET("/v1/packages/{package_id}", {
      params: { path: { package_id: mockIds.pkg("pkg_1035") } },
    }),
  );

test("the invoice is mandatory; the chosen documents are exported and downloaded", async () => {
  const pkg = await detail();
  const onOpenChange = vi.fn();
  renderWithQuery(<ExportDialog pkg={pkg} open onOpenChange={onOpenChange} onConflict={vi.fn()} />);
  expect(screen.getByRole("checkbox", { name: /^Faktura/ })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: /^Faktura/ })).toBeChecked();
  expect(screen.getByText("Daxili məlumatlar paketə daxil deyil")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("checkbox", { name: /^Sifariş/ })); // leave the order out
  await userEvent.click(screen.getByRole("button", { name: "İxrac et və manifesti yüklə" }));
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  expect(saveFile).toHaveBeenCalledWith(
    expect.stringMatching(/^PayProof_INV-1035_v\d+\.zip$/),
    expect.stringMatching(/\.zip$/),
  );
  const after = await detail();
  expect(after.status).toBe("EXPORTED");
  expect(after.exports[0]!.files.map((f) => f.type)).not.toContain("order");
});
