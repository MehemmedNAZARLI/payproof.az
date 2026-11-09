"use client";

import type { Schemas } from "@payproof/api-client";
import { formatDate } from "@payproof/api-client/format";
import { Check, Lock, Scale } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, fieldInput } from "@/components/ui/form-field";
import { bakuToday } from "@/features/tasks/helpers";
import { useCreateRequirementSet } from "../queries";
import { parseTolerance, sameRules } from "../rules";
import { RuleHistory } from "./rule-history";

const SWITCHES = [
  { key: "require_po", label: "Fakturada sifariş nömrəsi (PO) məcburidir", hint: "R-001, R-002" },
  { key: "require_delivery", label: "Təhvil sənədi məcburidir", hint: "R-007" },
  {
    key: "require_signature",
    label: "Təhvil aktında imza tələb olunur",
    hint: "R-008 — insan yoxlaması, hüquqi autentifikasiya deyil",
  },
] as const;
type Flag = (typeof SWITCHES)[number]["key"];
const APPROVER_ONLY = "Müştəri qaydasını yalnız təsdiqçi rolu təsdiqləyə bilər.";

/**
 * One customer's rule set (prototype `pgRules`). Every save is a new immutable version: the
 * customer's packages are re-checked and earlier approvals lapse. Render with `key` = version.
 */
export function CustomerRulesCard({
  customer,
  canSave,
}: {
  customer: Schemas["Customer"];
  canSave: boolean;
}) {
  const cur = customer.current_requirements;
  const save = useCreateRequirementSet(customer.id);
  const [flags, setFlags] = useState<Record<Flag, boolean>>({
    require_po: cur.require_po,
    require_delivery: cur.require_delivery,
    require_signature: cur.require_signature,
  });
  const [tolerance, setTolerance] = useState(cur.tolerance.replace(".", ","));
  const [reason, setReason] = useState("");
  const [shown, setShown] = useState(false);
  const parsed = parseTolerance(tolerance);
  const errors = {
    tolerance: parsed ? null : "Düzgün məbləğ yazın (0,00 – 1,00).",
    reason: reason.trim().length >= 10 ? null : "Ən azı 10 simvolla səbəb yazın.",
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return void toast.warning(APPROVER_ONLY);
    setShown(true);
    if (errors.tolerance || errors.reason || save.isPending) return;
    const next = { ...flags, tolerance: parsed! };
    if (sameRules(cur, next))
      return void toast.warning("Dəyişiklik yoxdur — yeni versiya yaradılmadı.");
    // mutateAsync, not a mutate callback: the saved version re-mounts this card before the
    // refresh ends, and React Query drops callbacks of an unmounted observer
    save
      .mutateAsync({
        ...next,
        reason: reason.trim(),
        effective_from: bakuToday(),
        expected_version: cur.version,
      })
      .then(
        (rs) =>
          toast.success(
            `${customer.name}: qayda dəsti v${rs.version} təsdiqləndi. Əlaqəli paketlər yenidən yoxlandı.`,
          ),
        () => {}, // the global handler already explains the error
      );
  };

  return (
    <section
      aria-labelledby={`rules-${customer.id}`}
      className="bg-surface border-border shadow-1 flex flex-col gap-3 rounded-lg border p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`rules-${customer.id}`} className="text-lg font-bold">
            {customer.name}
          </h2>
          <p className="text-text-3 text-xs">{`Xarici ID ${customer.external_id} · VÖEN ${customer.voen}`}</p>
        </div>
        <span className="bg-brand-50 text-brand inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-bold">
          <Scale aria-hidden className="size-3.5" />
          {`Qayda dəsti v${cur.version}`}
        </span>
      </div>
      <p className="text-text-2 text-sm">{`Qüvvədədir: ${formatDate(cur.effective_from)} · Təsdiqləyən: ${cur.approved_by.full_name}`}</p>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        {SWITCHES.map((s) => (
          <label
            key={s.key}
            className="has-focus-visible:ring-ring flex cursor-pointer items-start gap-3 rounded-md has-focus-visible:ring-2"
          >
            <input
              type="checkbox"
              role="switch"
              checked={flags[s.key]}
              onChange={(e) => setFlags({ ...flags, [s.key]: e.target.checked })}
              className="accent-brand mt-0.5 size-5 shrink-0 pointer-coarse:size-6"
            />
            <span>
              <b className="text-sm">{s.label}</b>
              <span className="text-text-3 block text-xs">{s.hint}</span>
            </span>
          </label>
        ))}
        <Field
          label="Yuvarlaqlaşdırma toleransı (AZN / USD)"
          error={shown ? errors.tolerance : null}
          hint="Böyük fərqi gizlədən geniş tolerans qəbul edilmir (maks. 1,00)."
        >
          {(id, d) => (
            <input
              id={id}
              inputMode="decimal"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
              aria-invalid={(shown && Boolean(errors.tolerance)) || undefined}
              aria-describedby={d}
              className={fieldInput}
            />
          )}
        </Field>
        <Field label="Dəyişikliyin əsaslandırılması" error={shown ? errors.reason : null}>
          {(id, d) => (
            <textarea
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Məs.: müştərinin 01.12.2026 tarixli təchizatçı təlimatı"
              aria-invalid={(shown && Boolean(errors.reason)) || undefined}
              aria-describedby={d}
              className={fieldInput}
            />
          )}
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-text-3 flex items-center gap-1 text-xs">
            {canSave ? (
              "Yeni versiya dərhal qüvvəyə minəcək."
            ) : (
              <>
                <Lock aria-hidden className="size-3.5" />
                Təsdiq üçün təsdiqçi rolu tələb olunur.
              </>
            )}
          </span>
          <Button
            type="submit"
            aria-disabled={!canSave || save.isPending}
            title={canSave ? undefined : APPROVER_ONLY}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
          >
            <Check aria-hidden />
            {save.isPending ? "Saxlanılır…" : "Yeni versiya kimi təsdiqlə"}
          </Button>
        </div>
      </form>
      {/* versions are numbered 1…n, so the current one is also the count */}
      <RuleHistory customerId={customer.id} count={cur.version} />
    </section>
  );
}
