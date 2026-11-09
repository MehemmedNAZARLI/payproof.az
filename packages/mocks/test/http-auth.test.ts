import { unwrap } from "@payproof/api-client";
import { describe, expect, it } from "vitest";
import { anonymous, as } from "./api";
import { assertSchema } from "./contract";

describe("auth handlers (via @payproof/api-client)", () => {
  it("lists only the demo login users", async () => {
    const { items } = await unwrap(anonymous.GET("/v1/auth/dev-users"));
    expect(items.map((u) => u.full_name)).toEqual([
      "Aygün Məmmədova",
      "Rəşad Əliyev",
      "Kamran Babayev",
    ]);
  });

  it("dev-login returns a session; /me returns the user with permissions", async () => {
    const api = await as("u2");
    const me = await unwrap(api.GET("/v1/me"));
    assertSchema("Me", me);
    expect(me).toMatchObject({ full_name: "Rəşad Əliyev", role: "approver" });
    expect(me.permissions).toContain("APPROVE_PACKAGE");
  });

  it("rejects unknown and assignee users at dev-login", async () => {
    await expect(
      anonymous.POST("/v1/auth/dev-login", {
        body: { user_id: "0193a000-0000-7000-8000-000000000003" },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });
  });

  it("401 without a token", async () => {
    await expect(anonymous.GET("/v1/me")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });
  });

  it("users (assignable) include assignees for the task picker, not readonly", async () => {
    const api = await as("u1");
    const { items } = await unwrap(
      api.GET("/v1/users", { params: { query: { assignable: true } } }),
    );
    items.forEach((u) => assertSchema("UserRef", u));
    expect(items.map((u) => u.role)).toContain("assignee");
    expect(items.map((u) => u.role)).not.toContain("readonly");
  });
});
