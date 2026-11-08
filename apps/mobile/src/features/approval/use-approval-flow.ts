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
  const key = useRef<string>("");
  const sending = useRef(false);

  const docs = reviewList(pkg, isSeen);
  const unseen = docs.filter((d) => !d.seen).length;
  const ack = ackFor === pkg.version;
  const ready = unseen === 0 && ack && online && !mutation.isPending;

  const begin = useCallback(() => {
    key.current = crypto.randomUUID();
    setAckFor(null);
    setFailure(null);
    setNudge(null);
    mutation.reset();
  }, [mutation]);

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
    // A conflict means the user reviewed an old version: start the review over, new attempt.
    if (f.kind === "conflict") {
      setAckFor(null);
      key.current = crypto.randomUUID();
    }
    setFailure(f);
  };

  const submit = (close: () => void) => {
    if (sending.current || mutation.isPending) return;
    if (!online) return setFailure({ kind: "offline" });
    if (unseen > 0) return point("docs");
    if (!ack) return point("ack");
    sending.current = true;
    setFailure(null);
    mutation.mutate(
      { key: key.current, version: pkg.version, ruleSetVersion: pkg.requirement_set.version },
      {
        onSuccess: () => {
          haptic("success");
          close();
          router.push(`/packages/${pkg.id}/success`);
        },
        onError: (error) => onFailure(error, close),
        onSettled: () => {
          sending.current = false;
        },
      },
    );
  };

  return {
    docs,
    unseen,
    ack,
    setAck,
    ready,
    online,
    pending: mutation.isPending,
    failure,
    nudge,
    begin,
    submit,
  };
}

export type ApprovalFlow = ReturnType<typeof useApprovalFlow>;
