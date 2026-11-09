import type { Schemas } from "@payproof/api-client";
import { Link2 } from "lucide-react";
import { Banner } from "@/components/ui/layout";
import { detailText as t } from "../texts";
import { Button } from "@/components/ui/button";

/**
 * The order link is an AI suggestion until a human confirms it (prototype `#matchBanner`).
 * The choice dialog itself is W-10.
 */
export function MatchBanner({
  pkg,
  onReview,
}: {
  pkg: Schemas["PackageDetail"];
  onReview: () => void;
}) {
  const { confirmed, candidates } = pkg.link;
  if (confirmed || pkg.status === "PROCESSING") return null;
  const title =
    candidates.length > 1
      ? `${candidates.length} mümkün sifariş tapıldı — seçim tələb olunur`
      : `Sifariş uyğunlaşdırması təsdiq gözləyir${candidates[0] ? `: ${candidates[0].po_number} namizəddir` : ""}`;
  return (
    <Banner
      role="region"
      aria-label={title}
      tone="warning"
      icon={Link2}
      title={title}
      actions={
        <Button size="sm" onClick={onReview}>
          <Link2 aria-hidden />
          {t.reviewMatch}
        </Button>
      }
    >
      {`${candidates.map((c) => `${c.po_number}: ${c.reason}`).join(" · ")} Semantik oxşarlıq sübut deyil — əlaqəni insan təsdiqləyir.`.trim()}
    </Banner>
  );
}
