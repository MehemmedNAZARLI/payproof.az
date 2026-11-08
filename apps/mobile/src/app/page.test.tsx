import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { endSession, startSession } from "@/lib/session";

import StartPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

beforeEach(() => replace.mockClear());

describe("StartPage", () => {
  it("opens home with a session", () => {
    startSession({
      access_token: "mock.u2",
      token_type: "bearer",
      expires_in: 60,
      user: {} as never,
    });
    render(<StartPage />);
    expect(replace).toHaveBeenCalledWith("/home");
  });

  it("opens the login without one", () => {
    endSession("expired");
    render(<StartPage />);
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
