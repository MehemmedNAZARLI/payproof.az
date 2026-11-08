"use client";

import { CheckOutcomeBadge, PackageStatusBadge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast-store";
import type { PackageStatus } from "@/lib/i18n";

export function BadgesSection() {
  const statuses: PackageStatus[] = [
    "PROCESSING",
    "NEEDS_REVIEW",
    "NEEDS_FIX",
    "READY_FOR_APPROVAL",
    "APPROVED_READY",
    "EXPORTED",
  ];
  return (
    <>
      <SectionHeader title="Status nişanları" />
      <Card className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <PackageStatusBadge key={s} status={s} />
        ))}
        {(["PASS", "FAIL", "UNKNOWN", "NOT_APPLICABLE"] as const).map((o) => (
          <CheckOutcomeBadge key={o} outcome={o} />
        ))}
      </Card>
    </>
  );
}

export function BannersSection() {
  return (
    <>
      <SectionHeader title="Bannerlər" />
      <div className="flex flex-col gap-2">
        <Banner
          tone="danger"
          icon="lock"
          title="Təsdiq mümkün deyil"
          action={<Button variant="secondary">Vebdə aç</Button>}
        >
          1 bloklayan problem: R-005
        </Banner>
        <Banner tone="brand" icon="lock" title="Təsdiqçi gözlənilir">
          Hazır paketi yalnız təsdiqçi rolu təsdiqləyə bilər.
        </Banner>
        <Banner tone="neutral" icon="clock" title="Emal olunur">
          Nəticə hazır olanda bildiriş alacaqsınız.
        </Banner>
      </div>
    </>
  );
}

export function FeedbackSection() {
  return (
    <>
      <SectionHeader title="Yüklənmə və boş vəziyyət" />
      <ListSkeleton rows={2} />
      <Card className="mt-2 p-0">
        <EmptyState
          icon="pass"
          title="Təsdiq gözləyən paket yoxdur"
          description="Bütün məcburi yoxlamalardan keçən paketlər burada görünəcək."
        />
      </Card>
      <SectionHeader title="Bildirişlər" />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          block
          icon="pass"
          onClick={() => toast.success("Paket təsdiqləndi.")}
        >
          Uğur
        </Button>
        <Button
          variant="secondary"
          block
          icon="fail"
          onClick={() => toast.error("Şəbəkə xətası", "Bağlantını yoxlayıb yenidən cəhd edin.")}
        >
          Xəta
        </Button>
      </div>
    </>
  );
}
