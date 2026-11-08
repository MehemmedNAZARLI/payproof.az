"use client";

import { useState } from "react";

import { AppHeader } from "@/components/ui/app-header";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { ListGroup, ListItem } from "@/components/ui/list";
import { toast } from "@/components/ui/toast-store";
import { useMe, useSignOut } from "@/features/auth/queries";
import type { Schemas } from "@/lib/api";
import { env } from "@/lib/env";
import { t } from "@/lib/i18n";
import { errorMessage } from "@/lib/query-client";

import { Identity, IdentitySkeleton, PermissionRow, SettingIcon, Value } from "./profile-parts";

const PERMISSIONS = Object.keys(t.permission) as Schemas["Permission"][];

export function ProfileScreen() {
  const me = useMe();
  const signOut = useSignOut();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <AppHeader large title={t.profile.title} />
      <main className="px-safe pb-tabbar mx-auto max-w-app">
        {/* Data first: a failed background refresh keeps the profile (a toast reports it). */}
        {me.data ? (
          <>
            <Identity me={me.data} />
            <SectionHeader title={t.profile.permissions} />
            <ListGroup label={t.profile.permissions}>
              {PERMISSIONS.map((p) => (
                <PermissionRow
                  key={p}
                  label={t.permission[p]}
                  granted={me.data.permissions.includes(p)}
                />
              ))}
            </ListGroup>
          </>
        ) : me.isError ? (
          <Card className="p-0">
            <EmptyState
              icon="alert"
              title={t.profile.loadFailed}
              description={errorMessage(me.error)}
              action={
                <Button variant="secondary" onClick={() => void me.refetch()}>
                  {t.common.retry}
                </Button>
              }
            />
          </Card>
        ) : (
          <IdentitySkeleton />
        )}

        <SectionHeader title={t.profile.settings} />
        <ListGroup label={t.profile.settings}>
          <ListItem
            leading={<SettingIcon name="globe" />}
            title={t.profile.language}
            trailing={<Value>{t.profile.languageValue}</Value>}
            onClick={() => toast.info(t.profile.languageSoon)}
          />
          <ListItem
            leading={<SettingIcon name="bell" />}
            title={t.profile.push}
            trailing={<Value>{t.profile.pushValue}</Value>}
            onClick={() => toast.info(t.profile.pushSoon)}
          />
          <ListItem
            leading={<SettingIcon name="eye" />}
            title={t.profile.appearance}
            trailing={<Value>{t.profile.appearanceValue}</Value>}
          />
          <ListItem
            leading={<SettingIcon name="monitor" />}
            title={t.profile.web}
            href={env.webUrl}
          />
        </ListGroup>

        <ListGroup className="mt-6">
          <li>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-danger active:bg-surface-2 flex min-h-13 w-full items-center justify-center gap-2 text-md font-semibold transition-colors"
            >
              <Icon name="logout" size={20} />
              {t.profile.signOut}
            </button>
          </li>
        </ListGroup>

        <p className="text-text-3 mt-6 px-4 text-center text-xs leading-relaxed">
          {t.profile.footnote}
        </p>
      </main>

      <BottomSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t.profile.signOutTitle}
        description={t.profile.signOutBody}
        footer={
          <div className="flex w-full flex-col gap-2">
            <Button block size="lg" variant="destructive" onClick={() => void signOut()}>
              {t.profile.signOut}
            </Button>
            <Button block size="lg" variant="plain" onClick={() => setConfirming(false)}>
              {t.profile.cancel}
            </Button>
          </div>
        }
      >
        {null}
      </BottomSheet>
    </>
  );
}
