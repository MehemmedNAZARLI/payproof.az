// Multipart parsing with the contract's file limits, and job creation for asynchronous work.
import { MockError } from "../domain/audit";
import { id } from "../ids";
import type { Job, MockDb } from "../store";
import type { Pkg } from "../types";

// shortcut: type is judged by extension; the real API checks magic bytes (security.md) — B-13.
const ALLOWED = /\.(pdf|png|jpe?g|csv|xlsx)$/i;
const MAX_BYTES = 20 * 1024 * 1024;

/** Validated `file` (Blob with a name) from multipart form data. */
export function fileField(form: FormData, field: string, optional = false): File | null {
  const f = form.get(field);
  if (f === null && optional) return null;
  if (!(f instanceof Blob))
    throw new MockError("VALIDATION_ERROR", "Fayl məcburidir.", 422, {
      fields: { [field]: "Məcburi sahə." },
    });
  const file = f as File;
  if (file.size > MAX_BYTES)
    throw new MockError("FILE_TOO_LARGE", "Fayl 20 MB-dan böyükdür.", 413, { max_mb: 20 });
  if (!ALLOWED.test(file.name ?? ""))
    throw new MockError(
      "UNSUPPORTED_FILE_TYPE",
      "Yalnız PDF, PNG, JPEG, CSV və XLSX qəbul olunur.",
      415,
    );
  return file;
}

export async function form(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw new MockError("VALIDATION_ERROR", "Sorğunun formatı yanlışdır.", 400);
  }
}

/** A job is RUNNING until `jobDelayMs` has passed; its effect is applied when first polled after that. */
export function startJob(
  db: MockDb,
  kind: "extract_document" | "create_package",
  p: Pkg | null,
  document_version_id?: string,
  error?: { code: string; message: string },
) {
  const job: Job = {
    id: id.job(++db.seq.job),
    kind,
    created_at: db.nowIso(),
    ready_at_ms: Date.now() + db.jobDelayMs,
    package_id: p?.id ?? null,
    document_version_id,
    error,
    done: false,
  };
  db.jobs.set(job.id, job);
  return job;
}
