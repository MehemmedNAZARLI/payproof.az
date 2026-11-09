import { ApiError, unwrap } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { ApproveDialog } from "./approve-dialog";

const mutate = vi.hoisted(() => ({ fn: null as null | ((...a: unknown[]) => void) }));
vi.mock("../approval", async (orig) => {
  const real = await orig<typeof import("../approval")>();
  return {
    ...real,
    useApprove: (id: string) => {
      const hook = real.useApprove(id);
      return mutate.fn ? { ...hook, mutate: mutate.fn } : hook;
    },
  };
});

beforeEach(() => {
  setToken(`mock.${mockIds.user("u2")}`);
  mutate.fn = null;
});

async function open() {
  const pkg = await unwrap(
    api.GET("/v1/packages/{package_id}", {
      params: { path: { package_id: mockIds.pkg("pkg_1038") } },
    }),
  );
  const props = { onOpenChange: vi.fn(), onConflict: vi.fn() };
  renderWithQuery(<ApproveDialog pkg={pkg} open {...props} />);
  return props;
}

test("shows what is approved and that it is not a payment approval", async () => {
  await open();
  expect(screen.getByText("Cari versiya").nextSibling).toHaveTextContent(/^v\d+$/);
  expect(screen.getByText(/keçdi · 0 uyğunsuz · 0 naməlum/)).toBeInTheDocument();
  expect(screen.getByText(/bank ödənişinə səlahiyyət vermir/)).toBeInTheDocument();
});

test("the review note is required; then the package is ready to send", async () => {
  const { onOpenChange } = await open();
  await userEvent.click(screen.getByRole("button", { name: "Təsdiqlə" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Təsdiqdən əvvəl bu qeydi işarələyin.");
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(screen.getByRole("button", { name: "Təsdiqlə" }));
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});

test("a version conflict hands over to the 'package updated' dialog", async () => {
  mutate.fn = (_v, opts) =>
    (opts as { onError: (e: ApiError) => void }).onError(
      new ApiError("VERSION_CONFLICT", "stale", 409),
    );
  const { onConflict } = await open();
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(screen.getByRole("button", { name: "Təsdiqlə" }));
  expect(onConflict).toHaveBeenCalled();
});

test("a newer version in the live query locks the dialog: nothing is sent", async () => {
  const sent = vi.fn();
  mutate.fn = sent;
  const pkg = await unwrap(
    api.GET("/v1/packages/{package_id}", {
      params: { path: { package_id: mockIds.pkg("pkg_1038") } },
    }),
  );
  const props = { onOpenChange: vi.fn(), onConflict: vi.fn() };
  const { rerender } = renderWithQuery(<ApproveDialog pkg={pkg} open {...props} />);
  await userEvent.click(screen.getByRole("checkbox"));
  // the live query now holds v+1 (someone else changed the package)
  rerender(<ApproveDialog pkg={{ ...pkg, version: pkg.version + 1 }} open {...props} />);
  expect(screen.getByText(`Başqa istifadəçi paketi yenilədi (v${pkg.version + 1}).`)).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Təsdiqlə" }));
  expect(sent).not.toHaveBeenCalled(); // never approves a version the user did not review
});
