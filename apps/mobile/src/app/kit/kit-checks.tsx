"use client";

import { SectionHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ListGroup, ListItem } from "@/components/ui/list";

export function ChecksSection({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      <SectionHeader
        title="Yoxlamalar"
        action={<span className="text-text-3 text-caption">8 keçdi · 1 bloklayır</span>}
      />
      <ListGroup label="Yoxlamalar">
        <ListItem
          leading={<Icon name="fail" size={22} className="text-danger-ink" />}
          title="Vahid qiymət uyğunluğu"
          subtitle="R-005 · Uyğunsuz"
          onClick={onOpen}
        />
        <ListItem
          leading={<Icon name="pass" size={22} className="text-success-ink" />}
          title="Miqdar uyğunluğu"
          subtitle="R-006 · Keçdi"
          onClick={onOpen}
        />
        <ListItem
          leading={<Icon name="file" size={22} />}
          title="Faktura · v1"
          subtitle="INV-1044.pdf"
          trailing={<span className="text-success-ink text-caption font-semibold">Baxılıb</span>}
        />
      </ListGroup>
    </>
  );
}
