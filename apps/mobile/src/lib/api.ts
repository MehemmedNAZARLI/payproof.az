import { createApiClient } from "./api/client";
import type { paths } from "./api/generated/schema";
import { env } from "./env";

export type { Schemas } from "./api/client";
export { ApiError, unwrap } from "./api/client";

export type PackageListQuery = NonNullable<paths["/v1/packages"]["get"]["parameters"]["query"]>;

type Fetch = (request: Request) => Promise<Response>;

// The mock (fixtures + MSW handlers) is a separate chunk, loaded only in mock mode.
let mock: Promise<Fetch> | undefined;
const mockFetch: Fetch = async (request) => {
  mock ??= import("./api/mock/mock-fetch").then((m) => m.createMockFetch());
  return (await mock)(request);
};

export const api = createApiClient({
  baseUrl: env.apiUrl,
  // shortcut: no session until M-04 (dev-login); the mock then serves the default demo approver.
  getToken: () => null,
  fetch: env.apiMock ? mockFetch : undefined,
});
