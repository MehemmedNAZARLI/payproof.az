"use client";

import { useState } from "react";

import { AppHeader } from "@/components/ui/app-header";
import { CheckOutcomeBadge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { TabBar } from "@/components/ui/tab-bar";
import { useMe } from "@/features/auth/queries";
import { t } from "@/lib/i18n";

import { ChecksSection } from "./kit-checks";
import { BadgesSection, BannersSection, FeedbackSection } from "./kit-feedback";
import { LivePackagesSection } from "./kit-live";
import { PdfSection } from "./kit-pdf";

const UNREAD = 3;

export function KitScreen() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const me = useMe().data;
  const close = () => setSheetOpen(false);
  return (
    <>
      <AppHeader
        large
        title="UI kit"
        subtitle={
          me ? `${me.full_name} · ${t.role[me.role]} · ${me.company.name}` : t.common.loading
        }
        trailing={
          <IconButton icon="bell" label={t.common.notificationsUnread(UNREAD)} count={UNREAD} />
        }
      />
      <main className="px-safe pb-tabbar mx-auto max-w-app">
        <LivePackagesSection />
        <ChecksSection onOpen={() => setSheetOpen(true)} />
        <BadgesSection />
        <BannersSection />
        <PdfSection />
        <FeedbackSection />
      </main>
      <BottomSheet
        open={sheetOpen}
        onClose={close}
        title="Unit price match"
        description="R-005 · INV-1044"
        footer={
          <Button block size="lg" variant="secondary" onClick={close}>
            Close
          </Button>
        }
      >
        <CheckOutcomeBadge outcome="FAIL" />
        <p className="text-text-2 mt-3 text-footnote leading-relaxed">
          Invoiceda GY-1L üçün vahid qiymət 9,50 AZN, təsdiqlənmiş sifarişdə isə 9,00 AZN-dir. Fərq
          tolerantlıqdan (0,01 AZN) böyükdür.
        </p>
        <p className="text-text-3 mt-4 text-caption">
          Swipe down, tap outside, or press Escape to close.
        </p>
      </BottomSheet>
      <TabBar notificationCount={UNREAD} />
    </>
  );
}
