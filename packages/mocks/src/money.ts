// Mock engine money: integer cents (qəpik). Contract strings in, contract strings out — never floats.

const DECIMAL = /^(-?)(0|[1-9][0-9]*)\.([0-9]{2})$/;

const safe = (n: number): number => {
  if (!Number.isSafeInteger(n)) throw new Error(`amount out of safe integer range: ${n}`);
  return n;
};

/** `"9.10"` → `910`. */
export function cents(value: string): number {
  const m = DECIMAL.exec(value);
  if (!m) throw new Error(`not a decimal string: ${JSON.stringify(value)}`);
  const n = Number(m[2]) * 100 + Number(m[3]);
  return safe(m[1] === "-" ? -n : n);
}

/** `910` → `"9.10"`. */
export function decimal(c: number): string {
  safe(c);
  const abs = Math.abs(c);
  return `${c < 0 ? "-" : ""}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export const sumLines = (lines: { qty: number; unit_price: string }[]): number =>
  lines.reduce((total, l) => safe(total + safe(l.qty * cents(l.unit_price))), 0);
