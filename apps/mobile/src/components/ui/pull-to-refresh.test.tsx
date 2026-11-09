import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { haptic } from "@/lib/haptics";

import { PullToRefresh } from "./pull-to-refresh";

vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }));

const at = (y: number) => ({ touches: [{ clientX: 100, clientY: y }] });

function pull(el: HTMLElement, distance: number) {
  fireEvent.touchStart(el, at(100));
  for (let y = 110; y <= 100 + distance; y += 10) fireEvent.touchMove(el, at(y));
  fireEvent.touchEnd(el, { touches: [] });
}

function setup() {
  let finish = () => {};
  const onRefresh = vi.fn(() => new Promise<void>((r) => (finish = r)));
  render(
    <PullToRefresh onRefresh={onRefresh}>
      <p>Siyahı</p>
    </PullToRefresh>,
  );
  return { onRefresh, finish: () => finish(), content: screen.getByText("Siyahı") };
}

describe("PullToRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.scrollY = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("refreshes once after a long pull, with a tick as it arms", async () => {
    const { onRefresh, finish, content } = setup();
    pull(content, 260);
    expect(haptic).toHaveBeenCalledWith("tap");
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(screen.getByTestId("ptr")).toHaveAttribute("data-busy", "true");
    pull(content, 260); // a second pull while it runs does nothing
    expect(onRefresh).toHaveBeenCalledOnce();
    await act(async () => {
      finish();
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByTestId("ptr")).toHaveAttribute("data-busy", "false");
  });

  it("springs back without refreshing after a short pull", () => {
    const { onRefresh, content } = setup();
    pull(content, 60);
    expect(onRefresh).not.toHaveBeenCalled();
    expect(haptic).not.toHaveBeenCalled();
  });

  it("leaves an ordinary scroll alone when the page is not at the top", () => {
    const { onRefresh, content } = setup();
    window.scrollY = 120;
    pull(content, 260);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("offers keyboard and screen-reader users a refresh that shows and says itself", async () => {
    const { onRefresh, finish } = setup();
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(screen.getByTestId("ptr")).toHaveAttribute("data-pulling");
    expect(status).toHaveTextContent("Refreshing…");
    await act(async () => {
      finish();
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(status).toBeEmptyDOMElement();
  });

  it("stops quietly when the screen goes away mid-refresh", async () => {
    let finish = () => {};
    const onRefresh = vi.fn(() => new Promise<void>((r) => (finish = r)));
    const errors = vi.spyOn(console, "error");
    const { unmount } = render(
      <PullToRefresh onRefresh={onRefresh}>
        <p>Siyahı</p>
      </PullToRefresh>,
    );
    pull(screen.getByText("Siyahı"), 260);
    unmount();
    await act(async () => {
      finish();
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(errors).not.toHaveBeenCalled();
  });
});
