export { ApiError, createApiClient, toFormData, unwrap } from "./client";
export type { ApiClient, ApiClientOptions, ErrorCode } from "./client";
export { subscribeEvents, type SubscribeEventsOptions } from "./events";
export type { components, operations, paths } from "./generated/schema";

import type { components } from "./generated/schema";
/** Contract schema by name: `Schemas["PackageDetail"]`. */
export type Schemas = components["schemas"];
