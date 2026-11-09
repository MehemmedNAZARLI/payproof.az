"use client";

import { TriangleAlert, Upload } from "lucide-react";
import { useState } from "react";
import type { samplesFor } from "../upload-helpers";

/** Demo files (mock mode) and a real file input with drag-and-drop. */
export function FilePicker({
  samples,
  mock,
  file,
  onChoose,
  invalid,
}: {
  samples: ReturnType<typeof samplesFor>;
  mock: boolean;
  file: File | null;
  onChoose: (file: File | null) => void;
  invalid: boolean;
}) {
  const [over, setOver] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {mock && (
        <div role="radiogroup" aria-label="Demo faylı seçin" className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Demo faylı seçin</span>
          {samples.length === 0 && (
            <p className="bg-surface-2 text-text-2 rounded-md p-3 text-sm">
              Bu paket və sənəd növü üçün sintetik demo faylı yoxdur.
            </p>
          )}
          {samples.map((s) => (
            <label
              key={s.id}
              className="relative border-border has-checked:border-brand has-checked:bg-brand-50 has-focus-visible:ring-ring flex cursor-pointer flex-col rounded-lg border-[1.5px] p-3 has-focus-visible:ring-2"
            >
              <input
                type="radio"
                name="sample"
                checked={file?.name === s.file_name}
                onChange={() =>
                  // shortcut: mock files are named stand-ins; the mock server matches them by name
                  // (named in the bytes too: the real server refuses a byte-identical file as a duplicate)
                  onChoose(
                    new File([`%PDF-1.4 demo ${s.file_name}`], s.file_name, {
                      type: "application/pdf",
                    }),
                  )
                }
                className="sr-only"
              />
              <b className="text-sm">{s.file_name}</b>
              <span className="text-text-3 text-xs">{s.note}</span>
              {s.duplicate && (
                <span className="text-warning mt-1 flex items-center gap-1 text-xs font-bold">
                  <TriangleAlert aria-hidden className="size-3.5" />
                  Təkrar fayl: paketdə eyni fayl var
                </span>
              )}
            </label>
          ))}
        </div>
      )}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onChoose(e.dataTransfer.files[0] ?? null);
        }}
        className={`has-focus-visible:ring-ring flex cursor-pointer flex-col items-center gap-1 rounded-lg border-[1.5px] border-dashed p-4 text-center text-sm has-focus-visible:ring-2 ${
          over ? "border-brand bg-brand-50" : invalid ? "border-danger" : "border-border"
        }`}
      >
        <Upload aria-hidden className="text-brand size-5" />
        <span className="font-semibold">Kompüterdən fayl seçin və ya bura atın</span>
        <span className="text-text-3 text-xs">
          {file && !samples.some((s) => s.file_name === file.name)
            ? file.name
            : "PDF və ya skan şəkli"}
        </span>
        <input
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => onChoose(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </label>
    </div>
  );
}
