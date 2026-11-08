import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { env } from "@/lib/env";
import { t } from "@/lib/i18n";
import { useOnline } from "@/lib/online";

import type { PackageCta } from "../cta";

export const webPackageHref = (id: string) => `${env.webUrl}/packages/${id}`;

export function OpenOnWeb({ id, label = t.detail.openWeb }: { id: string; label?: string }) {
  return (
    <a
      href={webPackageHref(id)}
      className="text-brand-600 flex min-h-11 items-center text-md font-semibold whitespace-nowrap active:opacity-50"
    >
      {label}
    </a>
  );
}

// Offline the button is truly disabled and says why right above it; approval needs the server.
function ApproveButton({ onApprove }: { onApprove?: () => void }) {
  const online = useOnline();
  return (
    <>
      {!online && (
        <p
          id="approve-offline"
          className="text-warning mb-2 flex items-center justify-center gap-1.5 text-sm font-medium"
        >
          <Icon name="wifi-off" size={16} />
          {t.approval.offline}
        </p>
      )}
      <Button
        size="lg"
        block
        icon={online ? "eye" : "lock"}
        onClick={onApprove}
        disabled={!online}
        aria-describedby={online ? undefined : "approve-offline"}
      >
        {t.detail.cta.approve}
      </Button>
    </>
  );
}

type CtaProps = { cta: PackageCta; id: string; onApprove?: () => void };

function CtaContent({ cta, id, onApprove }: CtaProps) {
  switch (cta.kind) {
    case "approve":
      return <ApproveButton onApprove={onApprove} />;
    case "awaiting-approver":
      return (
        <Banner tone="brand" icon="lock" title={t.detail.cta.awaitingTitle}>
          {t.detail.cta.awaitingBody}
        </Banner>
      );
    case "blocked":
      return (
        <Banner
          tone={cta.tone}
          icon="lock"
          title={t.detail.cta.blockedTitle}
          action={<OpenOnWeb id={id} />}
        >
          {t.detail.cta.blockedBody(cta.rules.length)}{" "}
          {cta.rules.map((rule, i) => (
            <span key={rule} className="whitespace-nowrap">
              {rule}
              {i < cta.rules.length - 1 && ", "}
            </span>
          ))}
        </Banner>
      );
    case "export-on-web":
      return (
        <a
          href={webPackageHref(id)}
          className="bg-brand-50 text-brand-700 flex h-13 w-full items-center justify-center gap-2 rounded-lg text-lg font-semibold transition-[transform,opacity] active:scale-[0.97] active:opacity-85"
        >
          <Icon name="monitor" size={22} />
          {t.detail.cta.exportOnWeb}
        </a>
      );
    case "ready":
      return (
        <Banner tone="success" title={t.detail.cta.readyTitle}>
          {t.detail.cta.readyBody}
        </Banner>
      );
    case "exported":
      return (
        <Banner tone="neutral" icon="download" title={t.detail.cta.exportedTitle(cta.version)}>
          {t.detail.cta.exportedBody}
        </Banner>
      );
    case "processing":
      return (
        <Banner tone="info" icon="clock" title={t.detail.cta.processingTitle}>
          {t.detail.cta.processingBody}
        </Banner>
      );
  }
}

// Pinned above the home indicator; content scrolls under a fade into the page background.
export function CtaBar(props: CtaProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
      <div className="px-safe pointer-events-auto mx-auto max-w-app bg-linear-to-t from-bg from-70% to-transparent pt-6 pb-[max(var(--safe-bottom),var(--sp-4))]">
        <CtaContent {...props} />
      </div>
    </div>
  );
}
