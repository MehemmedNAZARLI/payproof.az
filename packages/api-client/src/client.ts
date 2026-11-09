import createClient, { type Middleware } from "openapi-fetch";
import type { components, paths } from "./generated/schema";
import { errorFallback } from "./i18n/az";

export type ErrorCode = components["schemas"]["ErrorCode"] | "NETWORK_ERROR";

/** Every non-2xx response and network failure surfaces as ApiError; `message` is Azerbaijani and UI-safe. */
export class ApiError extends Error {
  override readonly name = "ApiError";
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Called per request; return null/undefined when signed out. */
  getToken?: () => string | null | undefined;
  /** Custom fetch (tests, MSW in node). */
  fetch?: (input: Request) => Promise<Response>;
}

const UNEXPECTED = errorFallback.INTERNAL_ERROR;
const OFFLINE = errorFallback.NETWORK_ERROR;

export async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.clone().json()) as {
      error?: { code?: ErrorCode; message?: string; details?: Record<string, unknown> };
    };
    if (body.error?.code && body.error.message) {
      return new ApiError(
        body.error.code,
        body.error.message,
        response.status,
        body.error.details ?? {},
      );
    }
  } catch {
    // not JSON — fall through
  }
  return new ApiError("INTERNAL_ERROR", UNEXPECTED, response.status);
}

export function createApiClient({ baseUrl, getToken, fetch }: ApiClientOptions) {
  // Resolve globalThis.fetch per request: MSW (node) patches it after modules create their client.
  const client = createClient<paths>({
    baseUrl,
    fetch: fetch ?? ((req) => globalThis.fetch(req)),
    // contract: array query params are `style: form, explode: false` → status=A,B
    querySerializer: { array: { style: "form", explode: false } },
  });
  const middleware: Middleware = {
    onRequest({ request }) {
      const token = getToken?.();
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
    async onResponse({ response }) {
      if (!response.ok) throw await toApiError(response);
      return response;
    },
    onError({ error }) {
      if (error instanceof ApiError) return error;
      // Cancellation (TanStack Query, navigation) is not an outage: rethrow the original AbortError.
      if (error instanceof Error && error.name === "AbortError") return;
      return new ApiError("NETWORK_ERROR", OFFLINE, 0, {}, { cause: error });
    },
  };
  client.use(middleware);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * `bodySerializer` for multipart endpoints (create package, upload document / version):
 * Blob/File fields are attached as files, numbers and booleans as strings, undefined is skipped.
 */
export function toFormData(body: unknown): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    form.append(key, value instanceof Blob ? value : String(value));
  }
  return form;
}

/**
 * `await unwrap(client.GET(...))` → the response body. Errors are already thrown as ApiError by the
 * middleware, so a resolved call always has data (`undefined` only for 204 endpoints).
 */
export async function unwrap<R extends { data?: unknown }>(
  request: Promise<R>,
): Promise<Exclude<R["data"], undefined>> {
  return (await request).data as Exclude<R["data"], undefined>;
}
