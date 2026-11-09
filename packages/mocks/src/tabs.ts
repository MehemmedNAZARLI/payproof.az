// Same-origin tabs (ADR-0010, mock mode): each tab has its own in-memory DB, so the writing tab posts the event
// together with its DB snapshot; the other tabs adopt the snapshot, then re-emit the event on their own stream.
import type { EventBus, LiveEvent } from "./events";
import { MockDb } from "./store";

// shortcut: last snapshot wins — two tabs writing within the same instant can lose one write; fine for a demo.
export function syncTabs(
  name: string,
  bus: EventBus,
  get: () => MockDb,
  set: (db: MockDb) => void,
) {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(name);
  let relaying = false;
  const off = bus.subscribe((event) => {
    if (!relaying) channel.postMessage({ event, db: get() });
  });
  channel.onmessage = ({ data }: MessageEvent<{ event: LiveEvent; db: MockDb }>) => {
    // structured clone keeps the fields (Maps included) but drops the class — put the prototype back
    set(Object.assign(Object.create(MockDb.prototype) as MockDb, data.db));
    relaying = true;
    try {
      bus.emit(data.event);
    } finally {
      relaying = false;
    }
  };
  return () => {
    off();
    channel.close();
  };
}
