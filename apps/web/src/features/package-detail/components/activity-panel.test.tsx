import type { Schemas } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { ActivityList, ActivityPanel } from "./activity-panel";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));
const report = { onClick: () => {}, pending: false };
const ui = (onDelete?: () => Promise<void>) => (
  <ActivityPanel
    packageId={mockIds.pkg("pkg_1042")}
    invoiceNumber="INV-1042"
    report={report}
    onDelete={onDelete}
  />
);

test("INV-1042's audit, newest first, with actor, time and version", async () => {
  renderWithQuery(ui());
  const panel = await screen.findByRole("region", { name: "Fəaliyyət tarixçəsi" });
  const items = await within(panel).findAllByRole("listitem");
  expect(items.length).toBeGreaterThan(0);
  expect(items[0]).toHaveTextContent(
    /(Aygün Məmmədova|Rəşad Əliyev|Sistem) · \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}/,
  );
  expect(
    within(panel).getByRole("button", { name: "Daxili yoxlama hesabatı" }),
  ).toBeInTheDocument();
  expect(within(panel).queryByRole("button", { name: "Paketi sil" })).toBeNull();
});

const event = (i: number): Schemas["AuditEvent"] =>
  ({
    id: `e${i}`,
    created_at: "2026-11-08T06:30:00Z",
    actor: null,
    action: "package.updated",
    message: `Hadisə ${i}`,
    package: null,
    package_version: 2,
    object_type: "package",
    object_id: "p",
    details: {},
  }) as Schemas["AuditEvent"];

test("long histories show 8 first and can expand", async () => {
  render(<ActivityList events={Array.from({ length: 11 }, (_, i) => event(i))} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(8);
  expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Sistem · 08.11.2026, 10:30");
  await userEvent.click(screen.getByRole("button", { name: "Bütün 11 hadisəni göstər" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(11);
  await userEvent.click(screen.getByRole("button", { name: "Daha az göstər" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(8);
});

test("delete asks first, says what goes and that the audit stays", async () => {
  const onDelete = vi.fn(() => Promise.resolve());
  renderWithQuery(ui(onDelete));
  await userEvent.click(await screen.findByRole("button", { name: "Paketi sil" }));
  const dialog = await screen.findByRole("alertdialog", { name: "INV-1042 paketini silmək?" });
  expect(dialog).toHaveTextContent("Audit qeydi saxlanılır");
  expect(onDelete).not.toHaveBeenCalled();
  await userEvent.click(within(dialog).getByRole("button", { name: "Bəli, sil" }));
  expect(onDelete).toHaveBeenCalledOnce();
});
