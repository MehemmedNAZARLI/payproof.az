import { mockIds } from "@payproof/mocks";
import { waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { setToken } from "@/lib/auth";
import { renderHookWithQuery } from "@/test/render";
import { auditCsv, auditFilter, useAudit } from "./queries";

beforeEach(() => setToken(`mock.${mockIds.user("u5")}`)); // read-only auditor

test("URL → filter: search text and actor (a user id or 'system'), anything else dropped", () => {
  const u2 = mockIds.user("u2");
  expect(auditFilter(new URLSearchParams(`q=INV-1036&actor=${u2}`))).toEqual({
    q: "INV-1036",
    actor: u2,
  });
  expect(auditFilter(new URLSearchParams("actor=system")).actor).toBe("system");
  expect(auditFilter(new URLSearchParams("actor=<script>")).actor).toBe("");
});

test("company-wide log, newest first; search and actor narrow it", async () => {
  const all = renderHookWithQuery(() => useAudit({ q: "", actor: "" }));
  await waitFor(() => expect(all.result.current.data).toBeDefined());
  const times = all.result.current.data!.items.map((e) => e.created_at);
  expect(times).toEqual([...times].sort().reverse());

  const system = renderHookWithQuery(() => useAudit({ q: "", actor: "system" }));
  await waitFor(() => expect(system.result.current.data).toBeDefined());
  expect(system.result.current.data!.items.every((e) => e.actor === null)).toBe(true);

  const found = renderHookWithQuery(() => useAudit({ q: "INV-1036", actor: "" }));
  await waitFor(() => expect(found.result.current.data).toBeDefined());
  expect(found.result.current.data!.items.length).toBeGreaterThan(0);
  expect(found.result.current.data!.items.length).toBeLessThan(times.length);
});

test("CSV of the filtered log", async () => {
  const csv = await auditCsv({ q: "INV-1036", actor: "" });
  expect(csv.split("\n")[0]).toBe("created_at,actor,action,invoice_number,package_version,message");
  expect(csv).toContain("INV-1036");
});
