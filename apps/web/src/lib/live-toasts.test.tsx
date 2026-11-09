import type { Schemas, SubscribeEventsOptions } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderHookWithQuery, testQueryClient } from "@/test/render";
import { useLiveUpdates } from "./live";
import { liveToastText, useLiveToasts } from "./live-toasts";

const sub = vi.hoisted(() => ({ options: undefined as SubscribeEventsOptions | undefined }));
vi.mock("@payproof/api-client", async (original) => ({
  ...(await original<typeof import("@payproof/api-client")>()),
  subscribeEvents: (o: SubscribeEventsOptions) => ((sub.options = o), () => {}),
}));
const toastInfo = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { info: toastInfo } }));

const AYGUN = mockIds.user("u1");
const RASHAD = mockIds.user("u2");
const PKG = mockIds.pkg("pkg_1042");
const ev = (
  type: string,
  actor_id: string | null,
  package_version: number | null = 5,
): Schemas["LiveEvent"] => ({
  event_id: "e1",
  company_id: "c1",
  type: type as Schemas["LiveEventType"],
  package_id: PKG,
  package_version,
  actor_id,
  at: "2026-11-08T09:12:00Z",
});

test.each([
  ["package.updated", "INV-1042", "Rəşad Əliyev INV-1042 paketini yenilədi (v5)"],
  ["package.approved", "INV-1042", "Rəşad Əliyev INV-1042 paketini təsdiqlədi (v5)"],
  ["package.exported", undefined, "Rəşad Əliyev paketi ixrac etdi (v5)"],
  ["task.changed", "INV-1042", "Rəşad Əliyev INV-1042 paketinin tapşırığını yenilədi"],
  ["requirements.changed", undefined, "Rəşad Əliyev müştəri qaydasını yenilədi"],
])("%s → %s", (type, invoice, text) => {
  expect(liveToastText(ev(type, RASHAD), { actor: "Rəşad Əliyev", invoice })).toBe(text);
});

test("system actions and notifications", () => {
  expect(liveToastText(ev("package.updated", null), { actor: null, invoice: "INV-1042" })).toBe(
    "Sistem INV-1042 paketini yenilədi (v5)",
  );
  expect(liveToastText(ev("notification.created", RASHAD), { actor: "Rəşad Əliyev" })).toBeNull();
});

beforeEach(() => {
  toastInfo.mockClear();
  setToken(`mock.${AYGUN}`);
});

const mount = async () => {
  const client = testQueryClient();
  client.setQueryData(["packages", "list", {}], {
    items: [{ id: PKG, invoice_number: "INV-1042" }],
  });
  const view = renderHookWithQuery(() => {
    useLiveUpdates();
    useLiveToasts();
  }, client);
  await waitFor(() => expect(client.getQueryData(["users", "list"])).toBeDefined());
  await waitFor(() => expect(client.getQueryData(["auth", "me"])).toBeDefined());
  return view;
};

test("another user's change: one toast per package, names from the caches", async () => {
  await mount();
  act(() => sub.options!.onEvent(ev("package.updated", RASHAD, 5)));
  act(() => sub.options!.onEvent(ev("package.approved", RASHAD, 6)));
  expect(toastInfo).toHaveBeenLastCalledWith("Rəşad Əliyev INV-1042 paketini təsdiqlədi (v6)", {
    id: `live:${PKG}`,
  });
  expect(new Set(toastInfo.mock.calls.map(([, o]) => o.id)).size).toBe(1); // merged into one toast
});

test("my own change: no toast", async () => {
  await mount();
  act(() => sub.options!.onEvent(ev("package.updated", AYGUN)));
  expect(toastInfo).not.toHaveBeenCalled();
});
