import { createApiClient } from "./api/client";
import type { paths } from "./api/generated/schema";
import { env } from "./env";
import { getToken } from "./session";

export type { Schemas } from "./api/client";
export { ApiError, unwrap } from "./api/client";

export type PackageListQuery = NonNullable<paths["/v1/packages"]["get"]["parameters"]["query"]>;

type Fetch = (request: Request) => Promise<Response>;

// The mock (fixtures + MSW handlers) is a separate chunk, loaded only in mock mode.
let mock: Promise<Fetch> | undefined;
const mockFetch: Fetch = async (request) => {
  // A failed chunk load is not cached, so the next request tries again.
  mock ??= import("./api/mock/mock-fetch").then(
    (m) => m.createMockFetch(),
    (error: unknown) => {
      mock = undefined;
      throw error;
    },
  );
  return (await mock)(request);
};

export const api = createApiClient({
  baseUrl: env.apiUrl,
  getToken,
  fetch: env.apiMock ? mockFetch : undefined,
});
