"use client";

import { ArrowRight, X } from "lucide-react";
import { useState } from "react";

const KEY = "payproof.intro-dismissed";
const FLOW = [
  "Sənədləri yüklə",
  "Çıxar və əlaqələndir",
  "Qaydalarla yoxla",
  "Düzəlt",
  "Təsdiqlə və ixrac et",
];

// Rendered client-side only (behind AuthGuard), so storage is readable in the initializer.
const dismissed = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** Product intro (prototype `.intro`); closing it is remembered per browser. */
export function IntroCard() {
  const [hidden, setHidden] = useState(dismissed);
  if (hidden) return null;

  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // shown again next visit
    }
  };

  return (
    <section
      aria-label="Məhsul haqqında"
      className="border-border shadow-1 from-brand-50 to-surface relative grid gap-4 rounded-lg border bg-linear-135 p-6"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Təqdimatı bağla"
        className="text-text-2 hover:bg-surface-2 focus-visible:ring-ring absolute top-2.5 right-2.5 grid size-10 place-items-center rounded-md outline-none focus-visible:ring-2 pointer-coarse:size-11"
      >
        <X aria-hidden className="size-5" />
      </button>
      <div>
        <span className="text-brand text-xs font-bold tracking-wider uppercase">
          PayProof · B2B maliyyə komandası üçün
        </span>
        <h2 className="mt-1.5 mb-2 max-w-[760px] pr-10 text-2xl leading-tight tracking-tight font-bold">
          Ödənişi ləngidə bilən sənəd problemini faktura müştəriyə getməzdən əvvəl tapın.
        </h2>
        <p className="text-text-2 max-w-[760px]">
          PayProof fakturanı sifariş və təhvil sənədi ilə tutuşdurur, uyğunsuzluğu mənbə sübutu ilə
          göstərir, düzəlişi məsul şəxsə yönləndirir və hazır paketi insan təsdiqindən sonra ixrac
          edir. AI sənədi oxuyur, rəqəmləri deterministik qayda mühərriki yoxlayır, qərarı insan
          verir.
        </p>
      </div>
      <ol aria-label="İş axını" className="flex flex-wrap items-center gap-1.5">
        {FLOW.map((step, i) => (
          <li key={step} className="text-text-2 flex items-center gap-1.5 text-sm font-semibold">
            <span className="bg-brand text-brand-foreground grid size-[22px] place-items-center rounded-full text-[11px] font-extrabold">
              {i + 1}
            </span>
            {step}
            {i < FLOW.length - 1 && <ArrowRight aria-hidden className="text-text-3 size-4" />}
          </li>
        ))}
      </ol>
    </section>
  );
}
