"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { toast } from "@/components/ui/toast-store";
import { orderedDocuments } from "@/features/package-detail/components/documents-list";
import { packageDetailKeys } from "@/features/package-detail/queries";
import type { Schemas } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { t } from "@/lib/i18n";
import { usePackageChangedSince } from "@/lib/live";
import { useOnline } from "@/lib/online";

import { type ApprovalFailure, approvalFailure, useApprove } from "./queries";

type Detail = Schemas["PackageDetail"];
export type Nudge = { step: "docs" | "ack"; n: number } | null;

/** Every document of the current version, in reading order, with whether it was seen. */
export const reviewList = (pkg: Detail, isSeen: (versionId: string) => boolean) =>
  orderedDocuments(pkg.documents).map((d) => ({ doc: d, seen: isSeen(d.current.id) }));

/**
 * The approval sheet's state, kept above the sheet so it survives opening a document and
 * coming back. The acknowledgement belongs to one package version: a new version clears it.
 * One Idempotency-Key per attempt, kept for retries of that attempt.
 */
export function useApprovalFlow(pkg: Detail, isSeen: (versionId: string) => boolean) {
  const qc = useQueryClient();
  const router = useRouter();
  const online = useOnline();
  const mutation = useApprove(pkg);
  const [ackFor, setAckFor] = useState<number | null>(null);
  const [failure, setFailure] = useState<ApprovalFailure | null>(null);
  const [nudge, setNudge] = useState<Nudge>(null);
  // One key per intent: approving this package version under this rule set version. Retries
  // of the same intent reuse it; a new version (or a fresh opening of the sheet) gets a new one.
  const attempt = useRef<{ key: string; version: number; ruleSet: number } | null>(null);
  const sending = useRef(false);
  // Someone else made a newer version while the sheet is open (live event, ADR-0010). The notice
  // stays for this opening of the sheet; the newer version loads by itself and must be reviewed.
  const newer = usePackageChangedSince(pkg.id, pkg.version);
  const [changed, setChanged] = useState<number | null>(null);
  if (newer !== null && (changed === null || newer > changed)) setChanged(newer);

  const docs = reviewList(pkg, isSeen);
  const unseen = docs.filter((d) => !d.seen).length;
  const ack = ackFor === pkg.version;
  // After a 409 the reviewed version is stale until the newer one has loaded.
  const stale =
    (failure?.kind === "conflict" &&
      failure.version !== undefined &&
      pkg.version < failure.version) ||
    newer !== null;
  const pending = mutation.isPending;
  const ready = unseen === 0 && ack && online && !pending && !stale;

  const keyFor = (version: number, ruleSet: number) => {
    const a = attempt.current;
    if (a && a.version === version && a.ruleSet === ruleSet) return a.key;
    attempt.current = { key: crypto.randomUUID(), version, ruleSet };
    return attempt.current.key;
  };

  // Opening the sheet starts a new intent, unless the last one is still on its way.
  const begin = useCallback(() => {
    setNudge(null);
    if (sending.current) return;
    attempt.current = null;
    setAckFor(null);
    setFailure(null);
    setChanged(null);
  }, []);

  const setAck = (on: boolean) => {
    setAckFor(on && unseen === 0 ? pkg.version : null);
    if (on) haptic("tap");
  };

  const point = (step: "docs" | "ack") => {
    haptic("warning");
    setNudge((n) => ({ step, n: (n?.n ?? 0) + 1 }));
  };

  const onFailure = (error: unknown, close: () => void) => {
    const f = approvalFailure(error);
    haptic("warning");
    void qc.invalidateQueries({ queryKey: packageDetailKeys.detail(pkg.id) });
    if (f.kind === "not-ready") {
      close();
      toast.error(t.approval.notReadyTitle, f.message);
      return;
    }
    // The user reviewed something that is no longer current: review again, as a new intent.
    if (f.kind === "conflict") {
      setAckFor(null);
      attempt.current = null;
    }
    setFailure(f);
  };

  const submit = (close: () => void) => {
    if (sending.current || pending || stale) return;
    if (!online) return setFailure({ kind: "offline" });
    if (unseen > 0) return point("docs");
    if (!ack) return point("ack");
    sending.current = true;
    setFailure(null);
    const version = pkg.version;
    const ruleSetVersion = pkg.requirement_set.version;
    // mutateAsync settles even if this component's observer is gone, so `sending` never sticks.
    mutation
      .mutateAsync({ key: keyFor(version, ruleSetVersion), version, ruleSetVersion })
      .then(
        () => {
          haptic("success");
          close();
          router.push(`/packages/${pkg.id}/success`);
        },
        (error: unknown) => onFailure(error, close),
      )
      .finally(() => {
        sending.current = false;
      });
  };

  return {
    docs,
    unseen,
    ack,
    setAck,
    ready,
    online,
    pending,
    failure,
    changed,
    nudge,
    begin,
    submit,
  };
}

export type ApprovalFlow = ReturnType<typeof useApprovalFlow>;
