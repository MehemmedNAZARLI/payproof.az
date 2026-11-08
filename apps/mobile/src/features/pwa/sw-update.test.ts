import { describe, expect, it, vi } from "vitest";

import { watchForUpdate } from "./sw-update";

function fakeSerwist() {
  const target = new EventTarget();
  return Object.assign(target, { messageSkipWaiting: vi.fn() });
}

// @serwist/window marks lifecycle events with isUpdate when a worker already controlled the page.
const fire = (sw: EventTarget, type: string, isUpdate = true) =>
  sw.dispatchEvent(Object.assign(new Event(type), { isUpdate }));

describe("service worker update", () => {
  it("offers a waiting version instead of taking over by itself", () => {
    const sw = fakeSerwist();
    const offer = vi.fn();
    watchForUpdate(sw, { offer, reload: vi.fn() });
    expect(offer).not.toHaveBeenCalled();
    fire(sw, "waiting");
    expect(offer).toHaveBeenCalledOnce();
    expect(sw.messageSkipWaiting).not.toHaveBeenCalled();
  });

  it("activates the new worker on request and reloads once it controls the page", () => {
    const sw = fakeSerwist();
    const reload = vi.fn();
    let apply = () => {};
    watchForUpdate(sw, { offer: (a) => (apply = a), reload });
    fire(sw, "waiting");
    apply();
    expect(sw.messageSkipWaiting).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
    fire(sw, "controlling");
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not reload when another tab activated the update; it offers a reload instead", () => {
    const sw = fakeSerwist();
    const reload = vi.fn();
    const offer = vi.fn();
    watchForUpdate(sw, { offer, reload });
    fire(sw, "controlling");
    expect(reload).not.toHaveBeenCalled();
    expect(offer).toHaveBeenCalledOnce();
    offer.mock.calls[0]![0]();
    expect(reload).toHaveBeenCalledOnce();
    expect(sw.messageSkipWaiting).not.toHaveBeenCalled();
  });

  it("stays quiet when the first install takes control (nothing to update from)", () => {
    const sw = fakeSerwist();
    const offer = vi.fn();
    const reload = vi.fn();
    watchForUpdate(sw, { offer, reload });
    fire(sw, "controlling", false);
    expect(offer).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("stops listening when disposed", () => {
    const sw = fakeSerwist();
    const offer = vi.fn();
    watchForUpdate(sw, { offer, reload: vi.fn() })();
    fire(sw, "waiting");
    expect(offer).not.toHaveBeenCalled();
  });
});
