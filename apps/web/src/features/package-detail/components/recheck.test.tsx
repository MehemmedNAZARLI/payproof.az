import { mockIds } from "@payproof/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { PackageDetailScreen } from "./package-detail-screen";

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn(), info: vi.fn() } }));
beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

test("'Yenidən yoxla' re-runs the rules, shows progress, then the result", async () => {
  renderWithQuery(<PackageDetailScreen id={mockIds.pkg("pkg_1044")} />);
  const button = await screen.findByRole("button", { name: "Yenidən yoxla" });
  expect(button).not.toHaveAttribute("aria-disabled", "true"); // no longer a placeholder
  await userEvent.click(button);
  await waitFor(() =>
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/^Paket v\d+ yenidən yoxlandı: Düzəliş tələb edir\.$/),
    ),
  );
});
