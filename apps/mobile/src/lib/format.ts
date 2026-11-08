// shortcut: until @payproof/api-client/format (S-05) exists; same signature, then re-export.

// The contract's Decimal: a string with exactly two fraction digits, never a float.
const DECIMAL = /^(-?)(0|[1-9]\d*)\.(\d{2})$/;
const MINUS = "−";

export function formatMoney(amount: string, currency?: string): string {
  const match = DECIMAL.exec(amount);
  if (!match) throw new Error(`Not a contract decimal: ${amount}`);
  const [, sign, whole = "", cents = ""] = match;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const text = `${sign ? MINUS : ""}${grouped},${cents}`;
  return currency ? `${text} ${currency}` : text;
}
