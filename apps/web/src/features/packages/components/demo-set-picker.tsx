import { demoSets } from "../new-package";

// shortcut: demo files are named stand-ins; the mock server recognises them by name
// (the name is in the bytes too: the real server refuses a byte-identical file as a duplicate)
const stub = (name: string) =>
  new File([`%PDF-1.4 demo ${name}`], name, { type: "application/pdf" });

/** Mock mode only: synthetic document sets the mock server recognises by file name. */
export function DemoSetPicker({
  invoice,
  onPick,
}: {
  invoice?: string;
  onPick: (customerName: string, files: Record<string, File>) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Demo sənəd dəsti" className="flex flex-col gap-2">
      <span className="text-sm font-semibold">Demo sənəd dəsti</span>
      {demoSets().map((s) => (
        <label
          key={s.id}
          className="relative border-border has-checked:border-brand has-checked:bg-brand-50 has-focus-visible:ring-ring flex cursor-pointer flex-col rounded-lg border-[1.5px] p-3 has-focus-visible:ring-2"
        >
          <input
            type="radio"
            name="demo-set"
            checked={invoice === s.files.invoice}
            onChange={() =>
              onPick(
                s.customerName,
                Object.fromEntries(Object.entries(s.files).map(([k, n]) => [k, stub(n)])),
              )
            }
            className="sr-only"
          />
          <b className="text-sm">{`${s.invoiceNumber} · ${s.customerName}`}</b>
          <span className="text-text-3 text-xs">{Object.values(s.files).join(" · ")}</span>
          <span className="text-text-2 text-xs">{s.note}</span>
        </label>
      ))}
    </div>
  );
}
