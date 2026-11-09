"use client";

import { SectionHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ListGroup, ListItem } from "@/components/ui/list";

export function ChecksSection({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      <SectionHeader
        title="Checks"
        action={<span className="text-text-3 text-caption">8 passed · 1 blocking</span>}
      />
      <ListGroup label="Checks">
        <ListItem
          leading={<Icon name="fail" size={22} className="text-danger-ink" />}
          title="Unit price match"
          subtitle="R-005 · Failed"
          onClick={onOpen}
        />
        <ListItem
          leading={<Icon name="pass" size={22} className="text-success-ink" />}
          title="Quantity match"
          subtitle="R-006 · Passed"
          onClick={onOpen}
        />
        <ListItem
          leading={<Icon name="file" size={22} />}
          title="Invoice · v1"
          subtitle="INV-1044.pdf"
          trailing={<span className="text-success-ink text-caption font-semibold">Reviewed</span>}
        />
      </ListGroup>
    </>
  );
}
