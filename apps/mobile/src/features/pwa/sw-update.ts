// A new deploy installs in the background and waits; the user decides when to switch, so an open
// approval sheet is never reloaded from under them. Taking the update activates the waiting worker
// and reloads on the browser's controllerchange (Serwist reports takeovers only for its own script
// URL; the browser does for any worker). If another tab activated it, this tab is already served
// by the new worker with old bundles in memory, so it offers a reload rather than forcing one.

// The slice of @serwist/window's Serwist used here (an EventTarget in tests).
type Lifecycle = "waiting" | "controlling";
type LifecycleEvent = { type: string; isUpdate?: boolean };
type UpdateSource = {
  addEventListener(type: Lifecycle, listener: (event: LifecycleEvent) => void): void;
  removeEventListener(type: Lifecycle, listener: (event: LifecycleEvent) => void): void;
  messageSkipWaiting(): void;
};

type Handlers = {
  /** Show the prompt; calling `apply` takes the update. */
  offer: (apply: () => void) => void;
  reload: () => void;
  /** Calls back once when a new worker takes control of the page (controllerchange). */
  onTakeover: (callback: () => void) => void;
};

export function watchForUpdate(
  sw: UpdateSource,
  { offer, reload, onTakeover }: Handlers,
): () => void {
  let requested = false;
  const onWaiting = () =>
    offer(() => {
      if (requested) return;
      requested = true;
      onTakeover(reload);
      sw.messageSkipWaiting();
    });
  const onControlling = (event: LifecycleEvent) => {
    // The very first install also takes control (clientsClaim); that is not an update. Our own
    // accepted update reloads through onTakeover.
    if (!event.isUpdate || requested) return;
    offer(reload);
  };
  sw.addEventListener("waiting", onWaiting);
  sw.addEventListener("controlling", onControlling);
  return () => {
    sw.removeEventListener("waiting", onWaiting);
    sw.removeEventListener("controlling", onControlling);
  };
}
