"use client";

import { useState } from "react";

import { PackageStatusBadge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { ListGroup, ListItem } from "@/components/ui/list";
import type { PackageStatus } from "@/lib/i18n";

const chips = [
  ["Hamısı", 14],
  ["Təsdiq gözləyir", 2],
  ["Problemli", 8],
  ["Hazır", 1],
  ["İxrac edilib", 2],
] as const;

export function ChipsSection() {
  const [selected, setSelected] = useState(0);
  return (
    <div
      role="group"
      aria-label="Status filtri"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]"
    >
      {chips.map(([label, count], i) => (
        <Chip key={label} pressed={selected === i} count={count} onClick={() => setSelected(i)}>
          {label}
        </Chip>
      ))}
    </div>
  );
}

const samples: [string, string, string, PackageStatus, number][] = [
  ["INV-1038", "4.860,00 AZN", "B Mağazalar Şəbəkəsi · v1", "READY_FOR_APPROVAL", 0],
  ["INV-1042", "12.000,00 AZN", "B Mağazalar Şəbəkəsi · v1", "NEEDS_REVIEW", 3],
  ["INV-1049", "1.800,00 USD", "C Restoran Qrupu · v1", "NEEDS_REVIEW", 1],
];

export function PackagesSection() {
  return (
    <>
      <SectionHeader title="Paketlər" />
      <ListGroup variant="cards" label="Paketlər">
        {samples.map(([inv, amount, sub, status, blocking]) => (
          <ListItem
            key={inv}
            href="/kit"
            title={inv}
            subtitle={sub}
            trailing={<span className="text-sm font-bold tabular-nums">{amount}</span>}
            meta={
              <>
                <PackageStatusBadge status={status} />
                {blocking > 0 && (
                  <span className="text-danger inline-flex items-center gap-1 text-xs font-semibold">
                    <Icon name="alert" size={14} />
                    {blocking} bloklayan
                  </span>
                )}
              </>
            }
          />
        ))}
      </ListGroup>
    </>
  );
}

export function ChecksSection({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      <SectionHeader
        title="Yoxlamalar"
        action={<span className="text-text-3 text-xs">8 keçdi · 1 bloklayır</span>}
      />
      <ListGroup label="Yoxlamalar">
        <ListItem
          leading={<Icon name="fail" size={22} className="text-danger" />}
          title="Vahid qiymət uyğunluğu"
          subtitle="R-005 · Uyğunsuz"
          onClick={onOpen}
        />
        <ListItem
          leading={<Icon name="pass" size={22} className="text-success" />}
          title="Miqdar uyğunluğu"
          subtitle="R-006 · Keçdi"
          onClick={onOpen}
        />
        <ListItem
          leading={<Icon name="file" size={22} />}
          title="Faktura · v1"
          subtitle="INV-1044.pdf"
          trailing={<span className="text-success text-xs font-semibold">Baxılıb</span>}
        />
      </ListGroup>
    </>
  );
}
