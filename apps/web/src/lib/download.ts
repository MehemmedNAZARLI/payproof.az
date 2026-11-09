/**
 * Hands a file to the browser as a download: a signed link is fetched first (a plain link would
 * bypass the mock service worker, and a cross-origin link ignores the file name), JSON is encoded.
 */
export async function saveFile(name: string, source: string | object | Blob) {
  const blob =
    source instanceof Blob
      ? source
      : typeof source === "string"
        ? await fetch(source).then((r) => {
            if (!r.ok) throw new Error(`Fayl yüklənmədi (${r.status}).`);
            return r.blob();
          })
        : new Blob([JSON.stringify(source, null, 2)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  // attached and revoked late: some browsers cancel a detached or instantly revoked download
  const link = Object.assign(document.createElement("a"), { href, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
