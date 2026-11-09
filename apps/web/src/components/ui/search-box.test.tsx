import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { SearchBox } from "./search-box";

const box = (value: string, onSearch = vi.fn()) => (
  <SearchBox label="Axtarış" placeholder="…" value={value} onSearch={onSearch} />
);

test("calls onSearch once typing pauses, with trimmed text", async () => {
  const onSearch = vi.fn();
  render(box("", onSearch));
  await userEvent.type(screen.getByRole("searchbox", { name: "Axtarış" }), " INV-10 ");
  expect(onSearch).not.toHaveBeenCalled();
  await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1), { timeout: 1000 });
  expect(onSearch).toHaveBeenCalledWith("INV-10");
});

test("follows the committed value when it changes elsewhere", () => {
  const { rerender } = render(box("INV-1042"));
  expect(screen.getByRole("searchbox")).toHaveValue("INV-1042");
  rerender(box(""));
  expect(screen.getByRole("searchbox")).toHaveValue("");
});

test("the debounced call uses the latest onSearch (filters changed while typing)", async () => {
  const stale = vi.fn();
  const fresh = vi.fn();
  const { rerender } = render(box("", stale));
  await userEvent.type(screen.getByRole("searchbox"), "INV");
  rerender(box("", fresh)); // e.g. a status was picked before the pause
  await waitFor(() => expect(fresh).toHaveBeenCalledWith("INV"), { timeout: 1000 });
  expect(stale).not.toHaveBeenCalled();
});
