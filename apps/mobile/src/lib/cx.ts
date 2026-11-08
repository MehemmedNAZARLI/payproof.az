// Joins class names, skipping falsy parts (conditional classes without a dependency).
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
