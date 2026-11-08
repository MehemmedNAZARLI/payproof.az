// Contract decimals ↔ integer cents. Money in the mock is never a float.

/** "12000.00" → 1200000n */
export const toCents = (amount: string): bigint => BigInt(amount.replace(".", ""));

/** Integer cents → contract Decimal ("-0.50" stays "-0.50", not "0.-50"). */
export function decimal(cents: bigint): string {
  const abs = cents < 0n ? -cents : cents;
  return `${cents < 0n ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}
