"use client";

import { ui } from "@payproof/api-client/i18n";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/auth";
import { useMe } from "../queries";

const noSubscribe = () => () => {};
const unknownOnServer = () => undefined; // the server can't see sessionStorage

/**
 * Renders the app only for a signed-in user: no token → /login. An expired token surfaces as 401
 * from `GET /v1/me`, which the query client's global handler turns into sign-out + /login.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const token = useSyncExternalStore(noSubscribe, getToken, unknownOnServer);
  const me = useMe({ enabled: Boolean(token) });

  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  if (me.data) return children;
  if (me.isError && me.error.status !== 401)
    return (
      <main role="alert" className="grid min-h-dvh place-items-center gap-3 p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-danger">{me.error.message}</p>
          <Button variant="outline" onClick={() => me.refetch()}>
            {ui.retry}
          </Button>
        </div>
      </main>
    );
  return (
    <p role="status" className="text-text-3 p-6">
      {ui.loading}
    </p>
  );
}
