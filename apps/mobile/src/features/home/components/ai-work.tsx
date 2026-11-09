"use client";

import { useQueries } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { packageDetailKeys } from "@/features/package-detail/queries";
import { usePackages } from "@/features/packages/queries";
import { api, unwrap } from "@/lib/api";

export function HowItWorks() {
  return (
    <section aria-label="How it works" className="my-5">
      <p className="text-text-3 mb-2 text-caption font-semibold">HOW IT WORKS</p>
      <ol className="text-text-2 flex items-center justify-between text-footnote font-medium">
        {["Read", "Check", "Approve", "Send"].map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            {index > 0 && (
              <span aria-hidden="true" className="text-text-3">
                →
              </span>
            )}
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function AiWork() {
  const packages = usePackages({ limit: 100 });
  const details = useQueries({
    queries: (packages.data?.items ?? []).map(({ id }) => ({
      queryKey: packageDetailKeys.detail(id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        unwrap(
          api.GET("/v1/packages/{package_id}", {
            params: { path: { package_id: id } },
            signal,
          }),
        ),
    })),
  });
  const loaded = details.flatMap((q) => (q.data ? [q.data] : []));
  const complete = packages.data && loaded.length === packages.data.items.length;
  const stats = [
    [
      "Documents read",
      loaded.reduce(
        (n, p) =>
          n +
          p.documents.filter((d) => ["EXTRACTED", "REVIEW_REQUIRED"].includes(d.current.status))
            .length,
        0,
      ),
    ],
    [
      "Fields extracted",
      loaded.reduce(
        (n, p) =>
          n + p.fields.filter((f) => f.review_status === "EXTRACTED" && f.value !== null).length,
        0,
      ),
    ],
    ["Checks passed", loaded.reduce((n, p) => n + p.summary.pass, 0)],
    ["Checks failed", loaded.reduce((n, p) => n + p.summary.fail, 0)],
  ] as const;
  return (
    <>
      <Card className="hero mb-5 p-5">
        <div className="flex items-center gap-2 text-footnote font-semibold">
          <Icon name="shield" size={18} /> AI work, ready for your review
        </div>
        <h2 className="mt-3 text-title2 font-bold">Every document. Every detail.</h2>
        <p className="text-hero-text2 mt-2 text-footnote">
          AI reads and cites. Rules decide. You stay in control.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dd className="text-title1 font-bold tabular-nums">{complete ? value : "—"}</dd>
              <dt className="text-hero-text2 text-caption">{label}</dt>
            </div>
          ))}
        </dl>
        <p className="text-hero-text2 mt-5 border-t border-white/15 pt-3 text-footnote">
          {complete
            ? `${loaded.filter((p) => p.status === "APPROVED_READY").length} ready to send · ${loaded.reduce((n, p) => n + p.summary.unknown, 0)} checks unknown`
            : "Loading document work…"}
        </p>
        <p className="text-hero-text2 mt-1 text-caption">
          {packages.isError || details.some((q) => q.isError)
            ? "Some work could not be loaded. Refresh to try again."
            : complete
              ? `Across ${loaded.length} loaded packages. Unknown results block approval.`
              : "Counts appear when all package details are available."}
        </p>
      </Card>
      <HowItWorks />
    </>
  );
}
