import { mockIds } from "@payproof/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import type { ListParams } from "../url";
import { PackageFilters } from "./package-filters";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));
const setup = (params: ListParams = {}) => {
  const onChange = vi.fn();
  const view = renderWithQuery(<PackageFilters params={params} onChange={onChange} />);
  return { onChange, view };
};

test("search is debounced, replaces history and starts from the first page", async () => {
  const { onChange } = setup({ cursor: "MjA", sort: "total" });
  await userEvent.type(screen.getByRole("searchbox", { name: "Axtarış" }), "INV-10");
  expect(onChange).not.toHaveBeenCalled();
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1), { timeout: 1000 });
  expect(onChange).toHaveBeenCalledWith({ q: "INV-10", sort: "total" }, "replace");
});

test("selects push a filter; options come from the API", async () => {
  const { onChange } = setup();
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status" }), "NEEDS_FIX");
  expect(onChange).toHaveBeenLastCalledWith({ status: ["NEEDS_FIX"] }, "push");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Problem növü" }), "R-002");
  expect(onChange).toHaveBeenLastCalledWith({ issue: "R-002" }, "push");
  const customer = await screen.findByRole("option", { name: "C Restoran Qrupu" });
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Müştəri" }), customer);
  expect(onChange).toHaveBeenLastCalledWith(
    { customer_id: (customer as HTMLOptionElement).value },
    "push",
  );
  expect(await screen.findByRole("option", { name: "Aygün Məmmədova" })).toBeInTheDocument();
});

test("date range and clear (sort survives)", async () => {
  const { onChange } = setup({ status: ["NEEDS_FIX"], sort: "-total" });
  const from = screen.getByLabelText("Tarixdən");
  await userEvent.type(from, "2026-10-01");
  expect(onChange).toHaveBeenLastCalledWith(
    { status: ["NEEDS_FIX"], sort: "-total", from: "2026-10-01" },
    "push",
  );
  await userEvent.click(screen.getByRole("button", { name: "Təmizlə" }));
  expect(onChange).toHaveBeenLastCalledWith({ sort: "-total" }, "push");
});

test("the search box follows the URL (Back button)", () => {
  const { view } = setup({ q: "INV-1042" });
  expect(screen.getByRole("searchbox", { name: "Axtarış" })).toHaveValue("INV-1042");
  view.rerender(<PackageFilters params={{}} onChange={vi.fn()} />);
  expect(screen.getByRole("searchbox", { name: "Axtarış" })).toHaveValue("");
  expect(screen.queryByRole("button", { name: "Təmizlə" })).toBeNull();
});

test("several statuses from a shared link are shown as such, not as the first one", async () => {
  const { onChange } = setup({ status: ["NEEDS_FIX", "NEEDS_REVIEW"] });
  const status = screen.getByRole("combobox", { name: "Status" });
  expect(status).toHaveDisplayValue("Bir neçə status (2)");
  await userEvent.selectOptions(status, "READY_FOR_APPROVAL");
  expect(onChange).toHaveBeenLastCalledWith({ status: ["READY_FOR_APPROVAL"] }, "push");
});
