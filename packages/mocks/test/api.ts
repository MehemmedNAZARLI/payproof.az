// Test harness: MSW node server + the real @payproof/api-client, logged in as a demo user.
import { createApiClient, unwrap } from "@payproof/api-client";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { createMockApi } from "../src/handlers";
import { id } from "../src/ids";

export const BASE = "http://api.test";
export const mock = createMockApi({ heartbeatMs: 50 });
const server = setupServer(...mock.handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => mock.reset());
afterAll(() => server.close());

const anonymous = createApiClient({ baseUrl: BASE });

/** Client authenticated through POST /v1/auth/dev-login (u1 operator, u2 approver, u5 readonly). */
export async function as(user: "u1" | "u2" | "u5") {
  const session = await unwrap(
    anonymous.POST("/v1/auth/dev-login", { body: { user_id: id.user(user) } }),
  );
  return createApiClient({ baseUrl: BASE, getToken: () => session.access_token });
}
export { anonymous };
export const pkgId = (n: number) => id.pkg(`pkg_${n}`);
