import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError, type Schemas, unwrap } from "@/lib/api";
import { createQueryClient } from "@/lib/query-client";
import { mockClient } from "@/test/mock";

import { PackageResults } from "./package-results";

vi.mock("next/navigation", () => ({}));

type List = Parameters<typeof PackageResults>[0]["list"];
const query = (state: Partial<List>) =>
  ({ refetch: vi.fn(), isPlaceholderData: false, fetchStatus: "idle", ...state }) as List;
const show = (list: List) =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <PackageResults list={list} onClear={() => {}} />
    </QueryClientProvider>,
  );

describe("PackageResults", () => {
  let page: Schemas["PackagePage"];
  beforeAll(async () => {
    const all = await unwrap(mockClient().GET("/v1/packages"));
    page = { items: all.items.slice(0, 3), next_cursor: null, total_count: 3 };
  });

  it("keeps showing rows when a background refresh fails (the toast says so)", () => {
    show(query({ data: page, isError: true, error: new ApiError("INTERNAL_ERROR", "x", 500) }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText("Could not load data")).toBeNull();
  });

  it("shows the error in place only when nothing was loaded yet", () => {
    show(query({ isError: true, error: new ApiError("INTERNAL_ERROR", "Server errorsı.", 500) }));
    expect(screen.getByText("Something went wrong. Try again shortly.")).toBeInTheDocument();
  });

  it("keeps the rows in place while a refresh fetches (the pull spinner shows it)", () => {
    show(query({ data: page, fetchStatus: "fetching" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("says it is offline on a first load without network", () => {
    show(query({ fetchStatus: "paused" }));
    expect(screen.getByText("No internet connection")).toBeInTheDocument();
  });
});
