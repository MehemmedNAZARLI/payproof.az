import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import { packageList } from "@/lib/api/mock/store";

import { PackageResults } from "./package-results";

vi.mock("next/navigation", () => ({}));

type List = Parameters<typeof PackageResults>[0]["list"];
const page = { items: packageList.slice(0, 3), next_cursor: null, total_count: 3 };
const query = (state: Partial<List>) =>
  ({ refetch: vi.fn(), isPlaceholderData: false, fetchStatus: "idle", ...state }) as List;
const show = (list: List) => render(<PackageResults list={list} onClear={() => {}} />);

describe("PackageResults", () => {
  it("keeps showing rows when a background refresh fails (the toast says so)", () => {
    show(query({ data: page, isError: true, error: new ApiError("INTERNAL_ERROR", "x", 500) }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText("Məlumat yüklənmədi")).toBeNull();
  });

  it("shows the error in place only when nothing was loaded yet", () => {
    show(query({ isError: true, error: new ApiError("INTERNAL_ERROR", "Server xətası.", 500) }));
    expect(screen.getByText("Server xətası.")).toBeInTheDocument();
  });

  it("keeps the rows in place while a refresh fetches (the pull spinner shows it)", () => {
    show(query({ data: page, fetchStatus: "fetching" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("says it is offline on a first load without network", () => {
    show(query({ fetchStatus: "paused" }));
    expect(screen.getByText("İnternet bağlantısı yoxdur")).toBeInTheDocument();
  });
});
