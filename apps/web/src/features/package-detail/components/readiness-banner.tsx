import type { Schemas } from "@payproof/api-client";
import { formatDateTime, formatMoney } from "@payproof/api-client/format";
import { CircleCheck, Clock, Download, Lock, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import { detailText as t } from "../texts";

type Pkg = Schemas["PackageDetail"];
type Tone = "danger" | "warning" | "success" | "brand" | "neutral";

/** The newest item by an ISO timestamp — the contract does not promise any list order. */
const latest = <T,>(items: T[], at: (item: T) => string) =>
  items.reduce<T | undefined>((m, x) => (!m || at(x) > at(m) ? x : m), undefined);

// shortcut: banner texts from the prototype's readiness(); move to shared i18n with detailText
const sumText = (s: Pkg["summary"]) =>
  `${s.pass} keçdi, ${s.fail} uyğunsuz, ${s.unknown} naməlum, ${s.not_applicable} tətbiq olunmur`;

function readiness(p: Pkg): { tone: Tone; icon: LucideIcon; title: string; body: string } {
  const v = p.version;
  switch (p.status) {
    case "PROCESSING":
      return {
        tone: "neutral",
        icon: Clock,
        title: "Sənədlər emal olunur",
        body: "Mətn qatı yoxlanır, lazım olduqda OCR tətbiq edilir. Emal bitməyincə heç bir nəticə göstərilmir.",
      };
    case "NEEDS_FIX":
    case "NEEDS_REVIEW":
      return {
        tone: p.status === "NEEDS_FIX" ? "danger" : "warning",
        icon: Lock,
        title: `Paket bloklanıb — ${p.summary.blocking.length} problem həll edilməlidir`,
        body: `R-010: cari v${v} bütün məcburi yoxlamalardan keçməyib (${sumText(p.summary)}). Bloklayan nəticələr düymə ilə gizlədilə bilməz.`,
      };
    case "READY_FOR_APPROVAL": {
      const invalid = latest(
        p.approvals.filter((a) => !a.valid),
        (a) => a.approved_at,
      );
      return {
        tone: "brand",
        icon: CircleCheck,
        title: `Bütün məcburi yoxlamalar v${v} üzrə keçdi — insan təsdiqi gözlənilir`,
        body: `${invalid ? `Əvvəlki v${invalid.package_version} təsdiqi etibarsızlaşıb və auditdə saxlanılır. ` : ""}Təsdiq yalnız sənəd paketinin hazırlığına aiddir.`,
      };
    }
    case "APPROVED_READY": {
      const a = p.current_approval;
      return {
        tone: "success",
        icon: CircleCheck,
        title: `${p.total ? `${formatMoney(p.total)}-lik faktura paketi` : "Faktura paketi"} göndərilməyə hazırdır`,
        body: `${a ? `Təsdiqləyən: ${a.approver.full_name} · ${formatDateTime(a.approved_at)} · v${a.package_version}. ` : ""}Bu, ödənişin təmin edildiyi demək deyil.`,
      };
    }
    case "EXPORTED": {
      // only an export of this version may be named under "v{v} paketi ixrac edilib"
      const e = latest(
        p.exports.filter((x) => x.package_version === v),
        (x) => x.created_at,
      );
      return {
        tone: "neutral",
        icon: Download,
        title: `v${v} paketi ixrac edilib`,
        body: `${e ? `${e.created_by.full_name} · ${formatDateTime(e.created_at)}. ` : ""}Göndərilmə və müştərinin qəbulu PayProof-dan kənarda izlənir (P1).`,
      };
    }
  }
}

/** R-010 overall readiness (prototype `readiness()`): one banner per status, never hideable. */
export function ReadinessBanner({ pkg, onRefresh }: { pkg: Pkg; onRefresh: () => void }) {
  const { tone, icon, title, body } = readiness(pkg);
  const processing = pkg.status === "PROCESSING";
  return (
    <Banner
      role="region"
      aria-label={title}
      tone={tone}
      icon={icon}
      title={title}
      className={cn(processing && "[&>svg]:motion-safe:animate-spin")}
      actions={
        processing && (
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw aria-hidden />
            {t.refreshProcessing}
          </Button>
        )
      }
    >
      {body}
    </Banner>
  );
}
