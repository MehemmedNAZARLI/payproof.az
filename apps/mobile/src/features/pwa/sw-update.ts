// A new deploy installs in the background and waits; the user decides when to switch, so an open
// approval sheet is never reloaded from under them. Taking the update activates the waiting worker
// and reloads once it controls the page. If another tab activated it, this tab is already served
// by the new worker with old bundles in memory, so it offers a reload rather than forcing one.

// The slice of @serwist/window's Serwist used here (an EventTarget in tests).
type Lifecycle = "waiting" | "controlling";
type UpdateSource = {
  addEventListener(type: Lifecycle, listener: () => void): void;
  removeEventListener(type: Lifecycle, listener: () => void): void;
  messageSkipWaiting(): void;
};

type Handlers = {
  /** Show the prompt; calling `apply` takes the update. */
  offer: (apply: () => void) => void;
  reload: () => void;
};

export function watchForUpdate(sw: UpdateSource, { offer, reload }: Handlers): () => void {
  let requested = false;
  const onWaiting = () =>
    offer(() => {
      requested = true;
      sw.messageSkipWaiting();
    });
  const onControlling = () => {
    if (requested) reload();
    else offer(reload);
  };
  sw.addEventListener("waiting", onWaiting);
  sw.addEventListener("controlling", onControlling);
  return () => {
    sw.removeEventListener("waiting", onWaiting);
    sw.removeEventListener("controlling", onControlling);
  };
}
