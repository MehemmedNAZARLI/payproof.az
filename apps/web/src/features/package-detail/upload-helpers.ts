import samples from "@fixtures/samples.json";

type DocType = "invoice" | "delivery";

export interface Sample {
  id: string;
  file_name: string;
  note: string;
  /** Already in the package: uploading it again must not create a version. */
  duplicate: boolean;
}

/** Demo files for mock mode; fixtures key packages as `pkg_1042`, the UI knows `INV-1042`. */
export function samplesFor(invoiceNumber: string, type: DocType, existing: string[]): Sample[] {
  const pkg = `pkg_${invoiceNumber.replace(/^INV-/, "")}`;
  return samples
    .filter((s) => s.package_id === pkg && s.type === type)
    .map((s) => ({
      id: s.id,
      file_name: s.file_name,
      note: s.note,
      duplicate: existing.includes(s.file_name),
    }));
}

export const UPLOAD_STAGES = ["Qəbul edildi", "Emal olunur", "Çıxarıldı", "Yoxlandı"] as const;

/** Index of the last reached stage in `UPLOAD_STAGES` (-1: nothing sent yet). */
export function stageOf(s: { accepted: boolean; job?: string; checked?: boolean }): number {
  if (!s.accepted) return -1;
  if (s.checked) return 3;
  if (s.job === "SUCCEEDED") return 2;
  if (s.job) return 1;
  return 0;
}
