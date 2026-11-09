import type { Schemas } from "@payproof/api-client";

import type { DocType, FixturePackage } from "./engine/model";
import { toUtc, userRef } from "./store";

// Documents of one fixture package in the contract's shape. IDs follow the contract examples:
// documents and versions are numbered per package in upload order (INV-1042 invoice v1 →
// …-8005-000010420001).

const pkgDigits = (p: FixturePackage) => p.id.replace(/\D/g, "").padStart(4, "0");
const id = (space: string, p: FixturePackage, n: number) =>
  `0193a000-0000-7000-${space}-0000${pkgDigits(p)}${String(n).padStart(4, "0")}`;

type FixtureVersion = FixturePackage["documents"][number]["versions"][number];

/** The package version a file arrived in: every re-upload (v2+) bumped the package version. */
function packageVersionAt(p: FixturePackage, v: FixtureVersion): number {
  const reuploads = p.documents
    .flatMap((d) => d.versions)
    .filter((w) => w.version_no > 1 && w.uploaded_at <= v.uploaded_at).length;
  return Math.min(1 + reuploads, p.version);
}

export type MockDocuments = {
  documents: Schemas["Document"][];
  /** Current version ID per document type, for evidence references. */
  currentVersionId: Partial<Record<DocType, string>>;
  /** Version ID by file name, for export records. */
  versionIdByFile: Map<string, string>;
};

export function mockDocuments(p: FixturePackage): MockDocuments {
  let seq = 0;
  const versionIdByFile = new Map<string, string>();
  const currentVersionId: MockDocuments["currentVersionId"] = {};
  const documents = p.documents.map((d, index): Schemas["Document"] => {
    const versions = d.versions.map((v): Schemas["DocumentVersion"] => {
      const versionId = id("8005", p, ++seq);
      versionIdByFile.set(v.file_name, versionId);
      return {
        id: versionId,
        version_no: v.version_no,
        file_name: v.file_name,
        source_kind: v.source_kind as Schemas["DocumentVersion"]["source_kind"],
        status: v.status as Schemas["DocumentVersionStatus"],
        sha256: v.sha256,
        uploaded_by: userRef(v.uploaded_by),
        uploaded_at: toUtc(v.uploaded_at),
        package_version_at_upload: packageVersionAt(p, v),
      };
    });
    const current = versions.at(-1)!;
    currentVersionId[d.type as DocType] = current.id;
    return {
      id: id("8004", p, index + 1),
      type: d.type as DocType,
      current,
      history: versions.slice(0, -1).reverse(),
    };
  });
  return { documents, currentVersionId, versionIdByFile };
}

/** Owner of a document version ID, so the file endpoint and the paper can find it. */
export function findVersion(
  packages: readonly FixturePackage[],
  versionId: string,
): { pkg: FixturePackage; type: DocType; version: Schemas["DocumentVersion"] } | undefined {
  for (const pkg of packages)
    for (const d of mockDocuments(pkg).documents) {
      const version = [d.current, ...d.history].find((v) => v.id === versionId);
      if (version) return { pkg, type: d.type, version };
    }
  return undefined;
}
