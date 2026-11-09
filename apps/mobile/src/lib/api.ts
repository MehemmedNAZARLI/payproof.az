import { createApiClient, type paths } from "@payproof/api-client";

import { env } from "./env";
import { getToken } from "./session";

export type { Schemas } from "@payproof/api-client";
export { ApiError, unwrap } from "@payproof/api-client";

export type PackageListQuery = NonNullable<paths["/v1/packages"]["get"]["parameters"]["query"]>;

type Fetch = (request: Request) => Promise<Response>;

// The mock (@payproof/mocks over the fixtures) is a separate chunk, loaded only in mock mode.
let mock: Promise<Fetch> | undefined;
export const mockFetch: Fetch = async (request) => {
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

/** The fetch API requests go through: the in-page mock, or the network. */
export const apiFetch: Fetch | undefined = env.apiMock ? mockFetch : undefined;

export const api = createApiClient({ baseUrl: env.apiUrl, getToken, fetch: apiFetch });
