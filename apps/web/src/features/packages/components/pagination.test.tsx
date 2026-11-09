import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Pagination } from "./pagination";

test("one page: only the count, no buttons", () => {
  render(<Pagination shown={14} total={14} nextCursor={null} onPage={vi.fn()} />);
  expect(screen.getByText("Göstərilir: 14 / 14 paket")).toBeInTheDocument();
  expect(screen.queryByRole("button")).toBeNull();
});

test("next page uses the server's cursor; a later page can go back to the first", async () => {
  const onPage = vi.fn();
  const { rerender } = render(
    <Pagination shown={20} total={45} nextCursor="MjA" onPage={onPage} />,
  );
  expect(screen.queryByRole("button", { name: "İlk səhifə" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Növbəti səhifə" }));
  expect(onPage).toHaveBeenLastCalledWith("MjA");

  rerender(<Pagination shown={20} total={45} nextCursor="NDA" cursor="MjA" onPage={onPage} />);
  await userEvent.click(screen.getByRole("button", { name: "İlk səhifə" }));
  expect(onPage).toHaveBeenLastCalledWith(undefined);
});
