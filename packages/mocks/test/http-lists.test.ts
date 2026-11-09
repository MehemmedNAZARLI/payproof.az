import { unwrap } from "@payproof/api-client";
import { describe, expect, it } from "vitest";
import { as } from "./api";
import { assertSchema } from "./contract";

describe("list handlers", () => {
  it("customers and requirement set history (newest first)", async () => {
    const api = await as("u5");
    const { items } = await unwrap(api.GET("/v1/customers"));
    items.forEach((c) => assertSchema("Customer", c));
    const sets = await unwrap(
      api.GET("/v1/customers/{customer_id}/requirements", {
        params: { path: { customer_id: items[0]!.id } },
      }),
    );
    expect(sets.items.map((s) => s.version)).toEqual([2, 1]);
  });

  it("tasks: active by default with status counts for tabs", async () => {
    const api = await as("u1");
    const res = await unwrap(api.GET("/v1/tasks"));
    expect(res.items).toHaveLength(6);
    expect(res.status_counts).toEqual({
      OPEN: 4,
      IN_PROGRESS: 2,
      SUBMITTED_FOR_RECHECK: 0,
      RESOLVED: 3,
    });
    res.items.forEach((t) => assertSchema("Task", t));
  });

  it("notifications are per user with an unread count", async () => {
    const api = await as("u2");
    const res = await unwrap(api.GET("/v1/notifications"));
    res.items.forEach((n) => assertSchema("Notification", n));
    expect(res.items).toHaveLength(4);
    expect(res.unread_count).toBe(2);
  });
});
