"use client";

import { useState } from "react";

import { AppHeader } from "@/components/ui/app-header";
import { CheckOutcomeBadge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { TabBar } from "@/components/ui/tab-bar";

import { BadgesSection, BannersSection, FeedbackSection } from "./kit-feedback";
import { ChecksSection, ChipsSection, PackagesSection } from "./kit-lists";

const UNREAD = 3;

export function KitScreen() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const close = () => setSheetOpen(false);
  return (
    <>
      <AppHeader
        large
        title="UI dəsti"
        subtitle="M-03 · mobil komponentlərin önizləməsi"
        trailing={
          <IconButton icon="bell" label={`Bildirişlər, ${UNREAD} oxunmamış`} count={UNREAD} />
        }
      />
      <main className="px-safe pb-tabbar mx-auto max-w-app">
        <ChipsSection />
        <PackagesSection />
        <ChecksSection onOpen={() => setSheetOpen(true)} />
        <BadgesSection />
        <BannersSection />
        <FeedbackSection />
      </main>
      <BottomSheet
        open={sheetOpen}
        onClose={close}
        title="Vahid qiymət uyğunluğu"
        description="R-005 · INV-1044"
        footer={
          <Button block size="lg" variant="secondary" onClick={close}>
            Bağla
          </Button>
        }
      >
        <CheckOutcomeBadge outcome="FAIL" />
        <p className="text-text-2 mt-3 text-sm leading-relaxed">
          Fakturada GY-1L üçün vahid qiymət 9,50 AZN, təsdiqlənmiş sifarişdə isə 9,00 AZN-dir. Fərq
          tolerantlıqdan (0,01 AZN) böyükdür.
        </p>
        <p className="text-text-3 mt-4 text-xs">
          Vərəqi aşağı sürüşdürərək, kənara toxunaraq və ya Esc ilə bağlayın.
        </p>
      </BottomSheet>
      <TabBar notificationCount={UNREAD} />
    </>
  );
}
