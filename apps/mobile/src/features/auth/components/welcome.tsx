"use client";

import { useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";

const KEY = "payproof.welcome.v1";
const subscribe = () => () => {};
const seen = () => {
  try {
    return localStorage.getItem(KEY) === "seen";
  } catch {
    return false;
  }
};
const cards: { title: string; body: string; icon: IconName }[] = [
  {
    title: "Upload the document set",
    body: "Your customer defines what is required. Bring invoices, statements and supporting documents together in one package.",
    icon: "package",
  },
  {
    title: "AI extracts every field with its source",
    body: "Trace each extracted value to a page and quote. Unreadable information stays unknown. Nothing is guessed.",
    icon: "file",
  },
  {
    title: "Rules check it, you approve, PayProof fills and sends the form",
    body: "Deterministic rules decide pass or fail. A human reviews the evidence before the customer’s form is filled and sent.",
    icon: "shield",
  },
];

export function Welcome({ children }: { children: React.ReactNode }) {
  const alreadySeen = useSyncExternalStore(subscribe, seen, () => undefined);
  const [finished, setFinished] = useState(false);
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const finish = () => {
    try {
      localStorage.setItem(KEY, "seen");
    } catch {
      /* Storage may be disabled. */
    }
    setFinished(true);
  };
  if (alreadySeen === undefined) return null;
  if (alreadySeen || finished) return children;
  return (
    <main className="px-safe pt-safe pb-safe mx-auto flex min-h-dvh max-w-app flex-col">
      <header className="flex items-center justify-between py-5">
        <h1 className="text-title3 font-bold">PayProof</h1>
        <Button variant="plain" onClick={finish}>
          Skip
        </Button>
      </header>
      <p className="text-accent mt-5 text-footnote font-semibold">Your documents, accounted for.</p>
      <div
        ref={track}
        aria-label="How PayProof works"
        aria-roledescription="carousel"
        className="mt-5 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-xl"
        onScroll={(event) => {
          const el = event.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {cards.map((card, i) => (
          <section
            key={card.title}
            aria-label={`Step ${i + 1} of 3`}
            className="w-full shrink-0 snap-center"
          >
            <div className="hero mb-8 flex h-48 items-center justify-center rounded-xl">
              <span className="bg-hero-fill grid size-24 place-items-center rounded-xl">
                <Icon name={card.icon} size={48} strokeWidth={1.4} />
              </span>
            </div>
            <h2 className="text-title1 font-bold text-pretty">{card.title}</h2>
            <p className="text-text-2 mt-4 pr-4 text-body">{card.body}</p>
          </section>
        ))}
      </div>
      <div className="mt-6 flex justify-center gap-1" aria-label="Welcome steps">
        {cards.map((card, i) => (
          <button
            key={card.title}
            type="button"
            aria-label={`Show step ${i + 1}`}
            aria-current={index === i ? "step" : undefined}
            className="grid size-11 place-items-center"
            onClick={() =>
              track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" })
            }
          >
            <span
              className={`h-2 rounded-full ${index === i ? "bg-accent w-6" : "bg-surface-3 w-2"}`}
            />
          </button>
        ))}
      </div>
      <div className="mt-auto pt-6 pb-6">
        <Button block size="lg" onClick={finish}>
          Get started
        </Button>
        <p className="text-text-3 mt-3 text-center text-caption">
          Review and approve on mobile. Upload and send on the web.
        </p>
      </div>
    </main>
  );
}
