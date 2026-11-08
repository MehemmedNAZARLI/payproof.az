import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/cx";
import { t } from "@/lib/i18n";

import type { ApprovalFlow } from "../use-approval-flow";

// "Təsdiqlə" stays tappable while locked (aria-disabled): a tap points at the missing step
// instead of doing nothing. Only a request in flight truly disables it.
export function ApprovalFooter({ flow, onClose }: { flow: ApprovalFlow; onClose: () => void }) {
  const locked = !flow.ready;
  return (
    <>
      <Button variant="secondary" size="lg" onClick={onClose} disabled={flow.pending}>
        {t.approval.cancel}
      </Button>
      <Button
        size="lg"
        className={cx("grow", locked && !flow.pending && "opacity-45 shadow-none")}
        aria-disabled={locked || undefined}
        aria-busy={flow.pending || undefined}
        onClick={() => flow.submit(onClose)}
      >
        {flow.pending ? (
          <>
            <Icon name="refresh" size={22} className="animate-spin" />
            {t.approval.confirming}
          </>
        ) : (
          <>
            <Icon name={locked ? "lock" : "check"} size={22} />
            {t.approval.confirm}
          </>
        )}
      </Button>
    </>
  );
}
