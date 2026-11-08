"use client";

import { useSyncExternalStore } from "react";

// "Add to Home Screen": Chromium hands over its install prompt (beforeinstallprompt, which fires
// once, early — so it is captured when this module loads); iPhone Safari has no prompt, so the hint
// explains its Share sheet. Other iOS browsers could not add web apps before iOS 16.4 and say
// nothing reliable about it, so they get no hint. An installed app gets none.

export type InstallKind = "prompt" | "ios" | "none";

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "payproof.installHint";

export function installKind(o: { standalone: boolean; canPrompt: boolean; ua: string }) {
  if (o.standalone) return "none";
  if (o.canPrompt) return "prompt";
  const iosSafari = /iPhone|iPad/.test(o.ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(o.ua);
  return iosSafari ? "ios" : "none";
}

let deferred: PromptEvent | null = null;
let installed = false;
let dismissed: boolean | undefined;
let snapshot: { kind: InstallKind; hintDismissed: boolean } | undefined;
const listeners = new Set<() => void>();

const changed = () => {
  snapshot = undefined;
  listeners.forEach((l) => l());
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep Chrome's mini-infobar away; the app offers it in context
    deferred = e as PromptEvent;
    changed();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    changed();
  });
}

const isStandalone = () =>
  installed ||
  window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function readDismissed() {
  if (dismissed === undefined) {
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      dismissed = false;
    }
  }
  return dismissed;
}

function getSnapshot() {
  snapshot ??= {
    kind: installKind({
      standalone: isStandalone(),
      canPrompt: deferred !== null,
      ua: navigator.userAgent,
    }),
    hintDismissed: readDismissed(),
  };
  return snapshot;
}

const SERVER = { kind: "none" as InstallKind, hintDismissed: true };

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

async function install() {
  const event = deferred;
  if (!event) return;
  deferred = null; // a prompt can be shown only once
  changed();
  await event.prompt();
  if ((await event.userChoice).outcome === "accepted") installed = true;
  changed();
}

function dismissHint() {
  dismissed = true;
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // blocked storage: dismissed for this visit only
  }
  changed();
}

export function useInstall() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => SERVER);
  return { ...state, install, dismissHint };
}

export function resetInstallForTests() {
  deferred = null;
  installed = false;
  dismissed = undefined;
  changed();
}
