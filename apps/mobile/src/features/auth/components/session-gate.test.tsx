import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { endSession, startSession } from "@/lib/session";
import { mockToken } from "@/test/mock";

import { SessionGate } from "./session-gate";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/packages",
}));

const signIn = () =>
  startSession({
    access_token: mockToken("u2"),
    token_type: "bearer",
    expires_in: 60,
    user: {} as never,
  });

const gate = () =>
  render(
    <SessionGate>
      <p>Paketlər</p>
    </SessionGate>,
  );

beforeEach(() => {
  replace.mockClear();
  window.history.replaceState(null, "", "/packages?status=ready");
});

describe("SessionGate", () => {
  it("shows the page with a session", () => {
    signIn();
    gate();
    expect(screen.getByText("Paketlər")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to the login and back to this page afterwards", () => {
    endSession("expired");
    gate();
    expect(screen.queryByText("Paketlər")).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login?next=%2Fpackages%3Fstatus%3Dready");
  });

  it("starts over after the user signs out", () => {
    signIn();
    gate();
    act(() => endSession("user"));
    expect(screen.queryByText("Paketlər")).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
