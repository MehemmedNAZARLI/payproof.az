// dev-users, dev-login, me, users.
import { http } from "msw";
import { MockError } from "../domain/audit";
import { id, slugOf } from "../ids";
import { me, userRef } from "../views/records";
import { currentUser, json, route, tokenFor, type Ctx } from "./http";

export const authHandlers = (ctx: Ctx) => [
  http.get(
    "*/v1/auth/dev-users",
    route(ctx, (_, db) =>
      json({
        items: db.users
          .filter((u) => u.demo_login)
          .map((u) => ({
            id: id.user(u.id),
            full_name: u.full_name,
            title: u.title,
            role: u.role,
          })),
      }),
    ),
  ),
  http.post(
    "*/v1/auth/dev-login",
    route(ctx, async ({ request }, db) => {
      const body = (await request.json().catch(() => null)) as { user_id?: string } | null;
      const slug = body?.user_id ? slugOf.user(body.user_id) : null;
      const user = slug ? db.user(slug) : undefined;
      if (!user?.demo_login)
        throw new MockError("VALIDATION_ERROR", "Demo istifadəçi tapılmadı.", 422, {
          fields: { user_id: "Naməlum istifadəçi." },
        });
      return json({
        access_token: tokenFor(id.user(user.id)),
        token_type: "bearer",
        expires_in: 28_800,
        user: me(db, user.id),
      });
    }),
  ),
  http.get(
    "*/v1/me",
    route(ctx, ({ request }, db) => json(me(db, currentUser(db, request).id))),
  ),
  http.get(
    "*/v1/users",
    route(ctx, ({ request }, db) => {
      currentUser(db, request);
      const assignable = new URL(request.url).searchParams.get("assignable") === "true";
      return json({
        items: db.users
          .filter((u) => !assignable || u.role !== "readonly")
          .map((u) => userRef(db, u.id)),
      });
    }),
  ),
];
