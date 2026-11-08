"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast-store";
import type { Schemas } from "@/lib/api";
import { appDescription, appName } from "@/lib/brand";
import { cx } from "@/lib/cx";
import { t } from "@/lib/i18n";
import { errorMessage } from "@/lib/query-client";
import { useSession } from "@/lib/session";

import { safeNextPath } from "../next-path";
import { useDevLogin, useDevUsers } from "../queries";

// The approver is the main mobile user, so that account comes first.
const ROLE_ORDER: Schemas["Role"][] = ["approver", "operator", "readonly", "admin", "assignee"];
const byRole = (a: Schemas["DevUser"], b: Schemas["DevUser"]) =>
  ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);

export function LoginScreen() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const session = useSession();
  const users = useDevUsers();
  const login = useDevLogin();

  // Already signed in (or just signed in): straight on to where the user was going.
  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  const signIn = (user: Schemas["DevUser"]) =>
    login.mutate(user.id, { onSuccess: () => toast.success(t.auth.signedIn(user.full_name)) });

  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <header className="hero pt-safe">
        <div className="px-safe mx-auto max-w-app pt-12 pb-14">
          <span className="grid size-14 place-items-center rounded-[16px] bg-white text-[#0d5d6b] shadow-2">
            <Icon name="shield" size={32} strokeWidth={1.9} />
          </span>
          <h1 className="mt-5 text-[34px] leading-tight font-bold tracking-tight">{appName}</h1>
          <p className="mt-1 text-md text-white/80">{appDescription}</p>
          <span className="mt-4 inline-flex h-7 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-semibold ring-1 ring-white/20 backdrop-blur">
            <Icon name="info" size={14} strokeWidth={2} />
            {t.auth.demoBadge}
          </span>
        </div>
      </header>

      <main className="bg-bg pb-safe relative -mt-6 flex-1 rounded-t-[28px]">
        <div className="px-safe mx-auto max-w-app pt-7 pb-8">
          <h2 className="text-xl font-bold tracking-tight">{t.auth.pickTitle}</h2>
          <p className="text-text-3 mt-0.5 text-sm">{t.auth.pickHint}</p>

          {users.isPending ? (
            <AccountsSkeleton />
          ) : users.isError ? (
            <EmptyState
              icon="alert"
              title={t.auth.unavailable}
              description={errorMessage(users.error)}
              action={
                <Button variant="secondary" onClick={() => void users.refetch()}>
                  {t.common.retry}
                </Button>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2.5" aria-label={t.auth.pickTitle}>
              {[...users.data.items].sort(byRole).map((user, i) => (
                <li key={user.id}>
                  <AccountButton
                    user={user}
                    recommended={i === 0 && user.role === "approver"}
                    busy={login.isPending && login.variables === user.id}
                    disabled={login.isPending || !!session}
                    onPress={() => signIn(user)}
                  />
                </li>
              ))}
            </ul>
          )}

          <p className="text-text-3 mt-6 px-2 text-center text-xs leading-relaxed">
            {t.auth.footnote}
          </p>
        </div>
      </main>
    </div>
  );
}

type AccountButtonProps = {
  user: Schemas["DevUser"];
  recommended: boolean;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
};

function AccountButton({ user, recommended, busy, disabled, onPress }: AccountButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-busy={busy}
      className={cx(
        "bg-surface flex min-h-18 w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left shadow-1",
        "transition-[transform,opacity] duration-base ease-base active:scale-[0.98]",
        "disabled:cursor-default",
        disabled && !busy && "opacity-50",
        recommended && "ring-brand-600/35 ring-[1.5px]",
      )}
    >
      <Avatar user={user} size="md" />
      <span className="min-w-0 grow">
        <span className="flex items-center gap-2">
          <span className="truncate text-md font-semibold">{user.full_name}</span>
          {recommended && <Badge tone="brand">{t.auth.recommended}</Badge>}
        </span>
        <span className="text-text-3 block truncate text-sm">
          {user.title} · {t.role[user.role]}
        </span>
      </span>
      {busy ? (
        <span
          role="status"
          aria-label={t.auth.signingIn}
          className="text-brand-600 size-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        <Icon name="chev-r" size={18} strokeWidth={2.2} className="text-text-3 shrink-0" />
      )}
    </button>
  );
}

function AccountsSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mt-4 flex flex-col gap-2.5">
      <span className="sr-only">{t.common.loading}</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-surface flex min-h-18 items-center gap-3.5 rounded-xl px-4 shadow-1"
        >
          <Skeleton className="size-11 rounded-full" />
          <span className="flex grow flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </span>
        </div>
      ))}
    </div>
  );
}
