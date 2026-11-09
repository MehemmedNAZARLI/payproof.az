import { mockIds } from "@payproof/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { RulesScreen } from "./rules-screen";

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
beforeEach(() => Object.values(toast).forEach((f) => f.mockReset()));

const card = (name: string) => screen.findByRole("region", { name });
const as = (user: string) => {
  setToken(`mock.${mockIds.user(user)}`);
  renderWithQuery(<RulesScreen />);
};

test("each customer shows its current rule set and the P1 contract card", async () => {
  as("u2");
  const b = await card("B Mağazalar Şəbəkəsi");
  expect(within(b).getByText("Qayda dəsti v2")).toBeInTheDocument();
  expect(within(b).getByRole("switch", { name: /imza tələb olunur/ })).toBeChecked();
  expect(screen.getByRole("heading", { name: "Müqavilədən qayda namizədi" })).toBeInTheDocument();
});

test("approver: validation, 'nothing changed', then a new version", async () => {
  as("u2");
  const c = await card("C Restoran Qrupu");
  const save = within(c).getByRole("button", { name: "Yeni versiya kimi təsdiqlə" });
  const tol = within(c).getByLabelText(/toleransı/);
  await userEvent.clear(tol);
  await userEvent.type(tol, "1,50");
  await userEvent.click(save);
  expect(within(c).getByText("Düzgün məbləğ yazın (0,00 – 1,00).")).toBeInTheDocument();
  expect(within(c).getByText("Ən azı 10 simvolla səbəb yazın.")).toBeInTheDocument();

  await userEvent.clear(tol);
  await userEvent.type(tol, "0,01");
  await userEvent.type(within(c).getByLabelText(/əsaslandırılması/), "Müştərinin məktubu, 07.11");
  await userEvent.click(save);
  expect(toast.warning).toHaveBeenCalledWith("Dəyişiklik yoxdur — yeni versiya yaradılmadı.");

  await userEvent.click(within(c).getByRole("switch", { name: /imza tələb olunur/ }));
  await userEvent.click(save);
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith(
      "C Restoran Qrupu: qayda dəsti v2 təsdiqləndi. Əlaqəli paketlər yenidən yoxlandı.",
    ),
  );
  expect(within(await card("C Restoran Qrupu")).getByText("Qayda dəsti v2")).toBeInTheDocument();
});

test("operator: the form is visible but saving is explained, not performed", async () => {
  as("u1");
  const c = await card("C Restoran Qrupu");
  const save = within(c).getByRole("button", { name: "Yeni versiya kimi təsdiqlə" });
  expect(save).toHaveAttribute("aria-disabled", "true");
  expect(within(c).getByText("Təsdiq üçün təsdiqçi rolu tələb olunur.")).toBeInTheDocument();
  await userEvent.click(save);
  expect(toast.warning).toHaveBeenCalledWith(
    "Müştəri qaydasını yalnız təsdiqçi rolu təsdiqləyə bilər.",
  );
});
