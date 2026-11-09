"use client";

import { loginText, roleLabel, ui } from "@payproof/api-client/i18n";
import { CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDevLogin, useDevUsers } from "../queries";

/** Dev auth: pick a demo user (`GET /v1/auth/dev-users`), sign in with `POST /v1/auth/dev-login`. */
export function LoginScreen() {
  const router = useRouter();
  const users = useDevUsers();
  const login = useDevLogin();
  const [picked, setPicked] = useState<string>();

  const submit = () => {
    if (!picked) return;
    login.mutate(picked, {
      onSuccess: ({ user }) => {
        toast.success(loginText.signedInAs(user.full_name));
        router.replace("/");
      },
    });
  };

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="bg-surface border-border shadow-2 w-full max-w-md overflow-hidden rounded-xl border">
        <header className="bg-brand text-brand-foreground flex flex-col gap-2 px-6 py-8">
          <ShieldCheck aria-hidden className="size-10" />
          <h1 className="text-3xl font-semibold tracking-tight">{loginText.brand}</h1>
          <p className="opacity-90">{loginText.tagline}</p>
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-brand-foreground/20 px-3 py-1 text-sm">
            <Info aria-hidden className="size-4" />
            {loginText.demoBadge}
          </span>
        </header>
        <section className="flex flex-col gap-3 p-6">
          <h2 id="login-pick" className="text-lg font-semibold">
            {loginText.pickTitle}
          </h2>
          {users.isPending && (
            <p role="status" className="text-text-3">
              {ui.loading}
            </p>
          )}
          {users.isError && (
            <div role="alert" className="flex items-center justify-between gap-3">
              <span className="text-danger">{ui.errorTitle}</span>
              <Button variant="outline" onClick={() => users.refetch()}>
                {ui.retry}
              </Button>
            </div>
          )}
          {users.data && (
            // Native radios: one tab stop, arrow keys, "1 of 3" for screen readers.
            <div role="radiogroup" aria-labelledby="login-pick" className="flex flex-col gap-3">
              {users.data.map((u) => (
                <label
                  key={u.id}
                  className={cn(
                    "border-border bg-surface relative flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-lg border-[1.5px] px-4 py-3 transition duration-base ease-base",
                    "has-checked:border-brand has-checked:bg-brand-50 has-focus-visible:ring-ring has-focus-visible:ring-2",
                  )}
                >
                  <input
                    type="radio"
                    name="demo-user"
                    value={u.id}
                    checked={picked === u.id}
                    onChange={() => setPicked(u.id)}
                    className="sr-only"
                  />
                  <span className="grow">
                    <b className="block">{u.full_name}</b>
                    <span className="text-text-3 text-sm">
                      {u.title} · {roleLabel[u.role]}
                    </span>
                  </span>
                  {picked === u.id && <CheckCircle2 aria-hidden className="text-brand size-5" />}
                </label>
              ))}
            </div>
          )}
          <Button
            size="lg"
            className="mt-2 h-11"
            disabled={!picked || login.isPending}
            onClick={submit}
          >
            {loginText.submit}
          </Button>
          <p className="text-text-3 text-center text-sm">{loginText.noPasswordHint}</p>
        </section>
      </div>
    </main>
  );
}
