"use client";

import { useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { t } from "@/lib/i18n";

import { useInstall } from "./install";

/** Starts adding the app: the browser's prompt, or the iPhone steps sheet. */
export function useInstallAction() {
  const install = useInstall();
  const [steps, setSteps] = useState(false);
  const start = () => (install.kind === "prompt" ? void install.install() : setSteps(true));
  const sheet = <IosSteps open={steps} onClose={() => setSteps(false)} />;
  return { ...install, available: install.kind !== "none", start, sheet };
}

/** A dismissible card for the home screen; gone once installed or dismissed. */
export function InstallCard() {
  const install = useInstallAction();
  if (!install.available || install.hintDismissed) return install.sheet;
  return (
    <>
      <Card className="relative mt-6">
        <div className="flex items-start gap-3 pr-8">
          {/* eslint-disable-next-line @next/next/no-img-element -- a 44px static icon, no optimiser needed */}
          <img src="/icons/icon-192.png" alt="" className="size-11 shrink-0 rounded-[10px]" />
          <div className="min-w-0">
            <h2 className="text-subhead font-semibold">{t.install.title}</h2>
            <p className="text-text-2 mt-0.5 text-footnote leading-snug text-pretty">
              {t.install.body}
            </p>
          </div>
        </div>
        <Button
          block
          variant="secondary"
          icon="plus-square"
          className="mt-3"
          onClick={install.start}
        >
          {t.install.add}
        </Button>
        <button
          type="button"
          aria-label={t.install.dismiss}
          onClick={install.dismissHint}
          className="text-text-3 absolute top-1 right-1 grid size-11 place-items-center rounded-full active:opacity-50"
        >
          <Icon name="x" size={16} strokeWidth={2.4} />
        </button>
      </Card>
      {install.sheet}
    </>
  );
}

const STEPS: { icon: IconName; text: string }[] = [
  { icon: "share", text: t.install.step1 },
  { icon: "plus-square", text: t.install.step2 },
  { icon: "check", text: t.install.step3 },
];

function IosSteps({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t.install.sheetTitle}
      description={t.install.body}
      footer={
        <Button block size="lg" onClick={onClose}>
          {t.install.done}
        </Button>
      }
    >
      <ol className="flex flex-col gap-3">
        {STEPS.map((s, i) => (
          <li key={s.icon} className="flex items-center gap-3">
            <span className="bg-accent-soft text-accent grid size-10 shrink-0 place-items-center rounded-lg">
              <Icon name={s.icon} size={22} />
            </span>
            <span className="text-subhead leading-snug">
              <span className="sr-only">{i + 1}. </span>
              {s.text}
            </span>
          </li>
        ))}
      </ol>
    </BottomSheet>
  );
}
