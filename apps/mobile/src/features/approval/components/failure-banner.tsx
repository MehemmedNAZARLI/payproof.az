import { Banner } from "@/components/ui/banner";
import { t } from "@/lib/i18n";

import type { ApprovalFlow } from "../use-approval-flow";

// Why the last attempt did not go through (or cannot), and what to do now. Announced to screen
// readers.
export function FailureBanner({ flow }: { flow: ApprovalFlow }) {
  const f =
    flow.failure ??
    (flow.changed !== null ? ({ kind: "changed", version: flow.changed } as const) : null) ??
    (flow.online ? null : ({ kind: "offline" } as const));
  if (!f) return null;
  const [tone, title, body] = ((): ["warning" | "danger" | "info", string, string?] => {
    switch (f.kind) {
      case "changed":
        return ["warning", t.live.changedTitle(f.version), t.live.changedBody];
      case "conflict":
        return ["warning", t.approval.conflictTitle, t.approval.conflictBody(f.version)];
      case "forbidden":
        return ["danger", t.approval.forbiddenTitle, t.approval.forbiddenBody];
      case "offline":
        return ["info", t.approval.offline];
      case "in-progress":
        return ["info", t.approval.inProgress];
      case "not-ready":
        return ["danger", t.approval.notReadyTitle, f.message];
      case "other":
        return ["danger", t.approval.failedTitle, f.message || t.errors.unexpected];
    }
  })();
  return (
    <div role="alert" className="mt-3">
      <Banner tone={tone} title={title}>
        {body}
      </Banner>
    </div>
  );
}
