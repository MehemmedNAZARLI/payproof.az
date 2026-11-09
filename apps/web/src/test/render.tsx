import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

/** Fresh client per test, no retries — errors surface immediately. */
export function testQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const wrapper = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

export function renderWithQuery(ui: ReactElement, client = testQueryClient()) {
  return { client, ...render(ui, { wrapper: wrapper(client) }) };
}

export function renderHookWithQuery<T>(hook: () => T, client = testQueryClient()) {
  return { client, ...renderHook(hook, { wrapper: wrapper(client) }) };
}
