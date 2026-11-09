import { mockIds } from "@payproof/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { taskFilter, TasksScreen } from "./tasks-screen";

const nav = vi.hoisted(() => ({ search: "", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push }),
}));
beforeEach(() => {
  setToken(`mock.${mockIds.user("u1")}`);
  nav.search = "";
  nav.push.mockClear();
});

const rows = async () =>
  within(await screen.findByRole("table", { name: "Tapşırıqlar" }))
    .getAllByRole("row")
    .slice(1);

test("URL filter: unknown values fall back, 'all' means every status", () => {
  expect(taskFilter(new URLSearchParams("status=nonsense"))).toEqual({
    status: "active",
    assignee: "",
  });
  expect(taskFilter(new URLSearchParams("status=all&assignee=x"))).toEqual({
    status: "",
    assignee: "",
  });
  const u6 = mockIds.user("u6");
  expect(taskFilter(new URLSearchParams(`assignee=${u6}`)).assignee).toBe(u6);
});

test("active tasks with counts per tab; nobody can mark a task resolved", async () => {
  renderWithQuery(<TasksScreen />);
  expect(await rows()).toHaveLength(6); // fixtures: 4 open + 2 in progress
  expect(screen.getByRole("button", { name: /Aktiv\s*6/, pressed: true })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Həll edilib\s*3/ })).toBeInTheDocument();
  // RESOLVED is set only by the system: no such action anywhere
  expect(screen.queryByRole("button", { name: /həll et|resolve/i })).toBeNull();
});

test("tabs and the assignee filter go to the URL", async () => {
  renderWithQuery(<TasksScreen />);
  await rows();
  await userEvent.click(screen.getByRole("button", { name: /Hamısı/ }));
  expect(nav.push).toHaveBeenLastCalledWith("/tasks?status=all", { scroll: false });
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "Məsul şəxs" })).toHaveTextContent(/Leyla/),
  );
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Məsul şəxs" }),
    mockIds.user("u6"),
  );
  expect(nav.push).toHaveBeenLastCalledWith(`/tasks?assignee=${mockIds.user("u6")}`, {
    scroll: false,
  });
});

test("take a task; cancelling asks first", async () => {
  renderWithQuery(<TasksScreen />);
  const before = (await rows()).length;
  const take = screen.getAllByRole("button", { name: "İcraya götür" });
  await userEvent.click(take[0]!);
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "İcraya götür" })).toHaveLength(take.length - 1),
  );
  await userEvent.click(screen.getAllByRole("button", { name: /tapşırığını ləğv et$/ })[0]!);
  const dialog = await screen.findByRole("alertdialog");
  await userEvent.click(within(dialog).getByRole("button", { name: "Bəli, ləğv et" }));
  await waitFor(async () => expect(await rows()).toHaveLength(before - 1));
});
