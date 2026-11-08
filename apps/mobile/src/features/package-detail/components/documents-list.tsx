import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { ListGroup, ListItem } from "@/components/ui/list";
import type { Schemas } from "@/lib/api";
import { t } from "@/lib/i18n";

type DocType = Schemas["DocumentType"];
export const docIcon: Record<DocType, IconName> = {
  invoice: "file",
  order: "cart",
  delivery: "truck",
};
const ORDER: DocType[] = ["invoice", "order", "delivery"];

/** The package's documents in the order a reviewer reads them: invoice, order, delivery. */
export const orderedDocuments = (docs: Schemas["Document"][]) =>
  [...docs].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));

type DocumentsListProps = {
  pkg: Schemas["PackageDetail"];
  /** Whether the current version of a document has been looked at (M-08). */
  isSeen?: (doc: Schemas["Document"]) => boolean;
  onOpen?: (doc: Schemas["Document"]) => void;
};

export function DocumentsList({ pkg, isSeen = () => false, onOpen }: DocumentsListProps) {
  const docs = orderedDocuments(pkg.documents);
  const seen = docs.filter(isSeen).length;
  const deliveryMissing =
    pkg.requirement_set.require_delivery && !docs.some((d) => d.type === "delivery");
  return (
    <section aria-labelledby="documents-title">
      <SectionHeader
        id="documents-title"
        title={t.detail.documents}
        action={
          <span className="text-text-3 pb-1 text-sm">
            {t.detail.documentsSeen(seen, docs.length)}
          </span>
        }
      />
      <ListGroup label={t.detail.documents}>
        {docs.map((d) => (
          <ListItem
            key={d.id}
            leading={<Icon name={docIcon[d.type]} size={24} />}
            title={`${t.document.type[d.type]} · v${d.current.version_no}`}
            subtitle={d.current.file_name}
            trailing={
              isSeen(d) && (
                <Badge tone="success" icon="check">
                  {t.detail.seen}
                </Badge>
              )
            }
            chevron={!isSeen(d) && onOpen !== undefined}
            onClick={onOpen && (() => onOpen(d))}
          />
        ))}
        {deliveryMissing && (
          <ListItem
            leading={<Icon name="truck" size={24} />}
            title={t.detail.noDelivery}
            subtitle={t.detail.noDeliveryBody}
            trailing={<Icon name="fail" size={22} strokeWidth={2} className="text-danger" />}
          />
        )}
      </ListGroup>
    </section>
  );
}
