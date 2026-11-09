"use client";

import { ui } from "@payproof/api-client/i18n";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { startMocking } from "@/lib/msw";

type State = "starting" | "ready" | "failed";

/** Mock mode: no request may leave before the MSW worker is up. Loaded client-only. */
export default function MockGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("starting");
  useEffect(() => {
    if (state !== "starting") return;
    startMocking().then(
      () => setState("ready"),
      () => setState("failed"),
    );
  }, [state]);

  if (state === "ready") return children;
  if (state === "failed")
    return (
      <main role="alert" className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          {/* dev-only screen: the worker file comes from `pnpm dev` (predev) */}
          <p className="text-danger">
            Demo API (MSW) işə düşmədi: public/mockServiceWorker.js yoxdur.
          </p>
          <Button variant="outline" onClick={() => setState("starting")}>
            {ui.retry}
          </Button>
        </div>
      </main>
    );
  return null;
}
