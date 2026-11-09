"use client";

import { ui } from "@payproof/api-client/i18n";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Banner, PageHeader } from "@/components/ui/layout";
import { Loading, SkeletonBar } from "@/components/ui/skeleton";
import { useCan } from "@/features/auth";
import { useCustomers } from "../queries";
import { CustomerRulesCard } from "./customer-rules-card";

export function RulesScreen() {
  const customers = useCustomers();
  const canSave = useCan("MANAGE_REQUIREMENTS");
  return (
    <>
      <PageHeader
        title="Müştəri qaydaları"
        description="P0-da qaydaları səlahiyyətli şəxs formadan daxil edir. Hər dəyişiklik yeni versiya yaradır; ixrac edilməmiş paketlər yenidən yoxlanır və əvvəlki təsdiqlər etibarsızlaşır."
      />
      {customers.isPending && (
        <Loading className="grid gap-4 @min-[880px]:grid-cols-2">
          <SkeletonBar className="h-96 w-full rounded-lg" />
          <SkeletonBar className="h-96 w-full rounded-lg" />
        </Loading>
      )}
      {customers.isError && (
        <Banner
          tone="danger"
          role="alert"
          title={ui.errorTitle}
          actions={
            <Button variant="outline" onClick={() => customers.refetch()}>
              {ui.retry}
            </Button>
          }
        >
          {customers.error.message}
        </Banner>
      )}
      {customers.data && (
        <div className="@container">
          <div className="grid items-start gap-4 @min-[880px]:grid-cols-2">
            {customers.data.map((c) => (
              // a new version re-mounts the card: the form starts from the saved rules
              <CustomerRulesCard
                key={`${c.id}:${c.current_requirements.version}`}
                customer={c}
                canSave={canSave}
              />
            ))}
            <section className="border-border flex flex-col gap-2 rounded-lg border border-dashed p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-lg font-bold">
                  <Sparkles aria-hidden className="size-4" />
                  Müqavilədən qayda namizədi
                </h2>
                <span className="bg-surface-2 text-text-2 rounded-sm px-1.5 text-[11px] font-bold">
                  P1
                </span>
              </div>
              <p className="text-text-2 text-sm">
                P1-də AI müqavilədən qayda namizədi çıxaracaq; insan təsdiqindən əvvəl həmin qayda
                maliyyə nəticəsini dəyişməyəcək.
              </p>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
