import { unwrap } from "@payproof/api-client";
import { describe, expect, it } from "vitest";
import { id } from "../src/ids";
import { as, mock } from "./api";
import { assertSchema } from "./contract";

describe("settings handlers", () => {
  it("only the approver adds a requirement set version (201); operator → 403", async () => {
    const send = async (user: "u1" | "u2") =>
      (await as(user)).POST("/v1/customers/{customer_id}/requirements", {
        params: { path: { customer_id: id.customer("c2") } },
        body: {
          require_po: true,
          require_delivery: true,
          require_signature: true,
          tolerance: "0.01",
          effective_from: "2026-12-01",
          reason: "Müştəri dekabrdan imzalı akt tələb edir.",
          expected_version: 1,
        },
      });
    await expect(send("u1")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const set = await unwrap(send("u2"));
    assertSchema("RequirementSet", set);
    expect(set.version).toBe(2);
  });

  it("marks notifications read; demo reset restores the fixtures", async () => {
    const api = await as("u2");
    const before = await unwrap(api.GET("/v1/notifications"));
    await api.POST("/v1/notifications/{notification_id}/read", {
      params: { path: { notification_id: before.items.find((n) => !n.read_at)!.id } },
    });
    expect((await unwrap(api.GET("/v1/notifications"))).unread_count).toBe(before.unread_count - 1);
    await api.POST("/v1/notifications/read-all");
    expect((await unwrap(api.GET("/v1/notifications"))).unread_count).toBe(0);
    mock.db.pkg("pkg_1042").version = 9;
    await api.POST("/v1/demo/reset");
    expect(mock.db.pkg("pkg_1042").version).toBe(1);
  });
});
