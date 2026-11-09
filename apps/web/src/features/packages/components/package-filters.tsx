"use client";

import type { Schemas } from "@payproof/api-client";
import { packageStatusLabel, ruleShort } from "@payproof/api-client/i18n";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/ui/search-box";
import { useCustomers } from "@/features/customers";
import { useAssignableUsers } from "@/features/users";
import type { ListParams } from "../url";

type Mode = "push" | "replace";
const FILTERS = ["q", "status", "customer_id", "issue", "owner_id", "from", "to"] as const;
const MANY = "__many__";
const STATUSES = Object.keys(packageStatusLabel) as Schemas["PackageStatus"][];
const control =
  "border-border-strong bg-surface focus-visible:ring-ring h-10 rounded-md border px-3 text-md outline-none focus-visible:ring-2 pointer-coarse:h-11";

const Select = ({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) => (
  <select
    aria-label={label}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`${control} min-w-[150px] max-md:flex-1`}
  >
    {children}
  </select>
);

/** Prototype `.filters`. Every change starts from the first page (cursor dropped). */
export function PackageFilters({
  params,
  onChange,
}: {
  params: ListParams;
  onChange: (next: ListParams, mode: Mode) => void;
}) {
  const customers = useCustomers().data ?? [];
  const owners = useAssignableUsers().data ?? [];
  const set = (patch: Partial<ListParams>, mode: Mode = "push") => {
    const next = { ...params, ...patch, cursor: undefined };
    onChange(
      Object.fromEntries(
        Object.entries(next).filter(([, v]) => v !== undefined && v !== ""),
      ) as ListParams,
      mode,
    );
  };

  return (
    <div className="border-border flex flex-wrap items-center gap-2 border-b p-4">
      <SearchBox
        label="Axtarış"
        placeholder="Faktura, müştəri, PO və ya təhvil aktı"
        value={params.q ?? ""}
        onSearch={(q) => set({ q: q || undefined }, "replace")}
        className="min-w-[220px] flex-[2]"
      />
      <Select
        label="Status"
        value={(params.status?.length ?? 0) > 1 ? MANY : (params.status?.[0] ?? "")}
        onChange={(v) => set({ status: v ? [v as Schemas["PackageStatus"]] : undefined })}
      >
        <option value="">Status: hamısı</option>
        {/* the API takes several statuses (shared links); this control picks one */}
        {(params.status?.length ?? 0) > 1 && (
          <option value={MANY} disabled>{`Bir neçə status (${params.status!.length})`}</option>
        )}
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {packageStatusLabel[s]}
          </option>
        ))}
      </Select>
      <Select
        label="Müştəri"
        value={params.customer_id ?? ""}
        onChange={(v) => set({ customer_id: v || undefined })}
      >
        <option value="">Müştəri: hamısı</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select
        label="Problem növü"
        value={params.issue ?? ""}
        onChange={(v) => set({ issue: v || undefined })}
      >
        <option value="">Problem: hamısı</option>
        {Object.entries(ruleShort).map(([id, short]) => (
          <option key={id} value={id}>{`${id} · ${short}`}</option>
        ))}
      </Select>
      <Select
        label="Məsul şəxs"
        value={params.owner_id ?? ""}
        onChange={(v) => set({ owner_id: v || undefined })}
      >
        <option value="">Məsul: hamısı</option>
        {owners.map((u) => (
          <option key={u.id} value={u.id}>
            {u.full_name}
          </option>
        ))}
      </Select>
      <label className="text-text-2 flex items-center gap-1.5 text-sm">
        Tarixdən
        <input
          type="date"
          value={params.from ?? ""}
          max={params.to}
          onChange={(e) => set({ from: e.target.value || undefined })}
          className={control}
        />
      </label>
      <label className="text-text-2 flex items-center gap-1.5 text-sm">
        Tarixədək
        <input
          type="date"
          value={params.to ?? ""}
          min={params.from}
          onChange={(e) => set({ to: e.target.value || undefined })}
          className={control}
        />
      </label>
      {FILTERS.some((k) => params[k] !== undefined) && (
        <Button
          variant="ghost"
          onClick={() => onChange(params.sort ? { sort: params.sort } : {}, "push")}
        >
          <X aria-hidden />
          Təmizlə
        </Button>
      )}
    </div>
  );
}
