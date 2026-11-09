import { actionLabel } from "@payproof/api-client/i18n";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/layout";

export type Refusal = "duplicate" | "conflict";

/** The server refused the upload (409): nothing changed — say why and what to do next. */
export function UploadRefusal({ kind, onRefresh }: { kind: Refusal; onRefresh: () => void }) {
  return kind === "duplicate" ? (
    <Banner
      tone="warning"
      role="alert"
      title="Bu fayl paketdə artıq var — yeni versiya yaradılmadı."
    >
      Eyni hash-li fayl ikinci dəfə qəbul edilmir. Düzəldilmiş faylı seçin.
    </Banner>
  ) : (
    <Banner
      tone="warning"
      role="alert"
      title="Paket yenilənib — başqa istifadəçi dəyişiklik edib."
      actions={
        <Button type="button" variant="outline" onClick={onRefresh}>
          <RefreshCw aria-hidden />
          {actionLabel.refresh}
        </Button>
      }
    >
      Yeniləyin və faylı yenidən göndərin.
    </Banner>
  );
}
