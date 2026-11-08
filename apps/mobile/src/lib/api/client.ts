import createClient from "openapi-fetch";

import { t } from "@/lib/i18n";

import type { components, paths } from "./generated/schema";

// shortcut: mirrors @payproof/api-client's createApiClient/ApiError (S-05); swap the import when it lands.

export type Schemas = components["schemas"];
export type ApiErrorCode = Schemas["ErrorCode"] | "NETWORK_ERROR";

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ClientOptions = {
  baseUrl: string;
  getToken: () => string | null;
  fetch?: (input: Request) => Promise<Response>;
};

export function createApiClient({ baseUrl, getToken, fetch }: ClientOptions) {
  const client = createClient<paths>({ baseUrl, fetch });
  client.use({
    onRequest({ request }) {
      const token = getToken();
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
  });
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

type Result = { data?: unknown; error?: unknown; response: Response };
type Data<R extends Result> = Exclude<R["data"], undefined>;

// Resolves to the body of a 2xx response; anything else becomes an ApiError.
export async function unwrap<R extends Result>(request: Promise<R>): Promise<Data<R>> {
  let result: R;
  try {
    result = await request;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("NETWORK_ERROR", t.errors.network, 0);
  }
  if (result.error === undefined) return result.data as Data<R>;
  throw toApiError(result.error, result.response.status);
}

function toApiError(body: unknown, status: number): ApiError {
  if (isErrorBody(body)) {
    const { code, message, details } = body.error;
    return new ApiError(code, message, status, details);
  }
  return new ApiError("INTERNAL_ERROR", t.errors.unexpected, status);
}

function isErrorBody(body: unknown): body is Schemas["Error"] {
  if (typeof body !== "object" || body === null || !("error" in body)) return false;
  const e: unknown = body.error;
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof e.code === "string" &&
    "message" in e &&
    typeof e.message === "string"
  );
}
