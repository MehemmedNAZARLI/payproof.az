import type { Schemas, SubscribeEventsOptions } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { authKeys } from "@/features/auth";
import { setToken } from "@/lib/auth";
import { renderHookWithQuery, testQueryClient } from "@/test/render";
import { useLiveUpdates } from "./live";
import { StaleBanner, usePackageChangedSince } from "./stale";

const sub = vi.hoisted(() => ({ options: undefined as SubscribeEventsOptions | undefined }));
vi.mock("@payproof/api-client", async (original) => ({
  ...(await original<typeof import("@payproof/api-client")>()),
  subscribeEvents: (o: SubscribeEventsOptions) => ((sub.options = o), () => {}),
}));

const ME = mockIds.user("u1");
const OTHER = mockIds.user("u2");
const ev = (
  package_id: string,
  package_version: number,
  actor_id = OTHER,
): Schemas["LiveEvent"] => ({
  event_id: "e1",
  company_id: "c1",
  type: "package.updated",
  package_id,
  package_version,
  actor_id,
  at: "2026-11-08T09:12:00Z",
});

beforeEach(() => setToken(`mock.${ME}`));

const watch = async (packageId: string, version: number) => {
  const client = testQueryClient();
  const view = renderHookWithQuery(() => {
    useLiveUpdates();
    return usePackageChangedSince(packageId, version);
  }, client);
  await waitFor(() => expect(client.getQueryData(authKeys.me())).toBeDefined());
  return view;
};

test("a newer version of this package by someone else → that version", async () => {
  const { result } = await watch("p1", 4);
  expect(result.current).toBeNull();
  act(() => sub.options!.onEvent(ev("p2", 9))); // another package
  act(() => sub.options!.onEvent(ev("p1", 4))); // not newer
  expect(result.current).toBeNull();
  act(() => sub.options!.onEvent(ev("p1", 5)));
  expect(result.current).toBe(5);
});

test("my own change (e.g. this dialog's upload) is not 'someone else's'", async () => {
  const { result } = await watch("p1", 4);
  act(() => sub.options!.onEvent(ev("p1", 5, ME)));
  expect(result.current).toBeNull();
});

test("StaleBanner tells what happened and offers a refresh", async () => {
  const onRefresh = vi.fn();
  render(<StaleBanner version={5} onRefresh={onRefresh} />);
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent("Başqa istifadəçi paketi yenilədi (v5).");
  expect(alert).toHaveTextContent("Davam etmək üçün yenidən baxın.");
  await userEvent.click(screen.getByRole("button", { name: "Yenilə" }));
  expect(onRefresh).toHaveBeenCalledOnce();
});
