import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Section } from "./section";

const base = { data: undefined, error: null, refetch: vi.fn(), fetchStatus: "idle" as const };

describe("Section", () => {
  it("says it is offline instead of loading forever when nothing was saved", () => {
    render(
      <Section query={{ ...base, fetchStatus: "paused" }} skeleton={<p>skeleton</p>}>
        {() => null}
      </Section>,
    );
    expect(screen.queryByText("skeleton")).toBeNull();
    expect(screen.getByText("No internet connection")).toBeVisible();
  });

  it("shows saved data even while offline", () => {
    render(
      <Section query={{ ...base, data: 3, fetchStatus: "paused" }} skeleton={null}>
        {(n) => <p>{n} packages</p>}
      </Section>,
    );
    expect(screen.getByText("3 packages")).toBeVisible();
  });
});
