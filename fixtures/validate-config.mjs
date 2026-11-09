// Configurable document sets (ADR-0011): fixtures/config/*.json and fixtures/scenarios/*.json.
// Schema validity plus cross-file invariants. Called from validate.mjs (pnpm fixtures:check).
import fs from "node:fs";
import path from "node:path";

const SCENARIOS = ["unec"];
const PARTY_PARTS = new Set(["name", "tax_id", "id_number"]);
const MONEY = /^-?(0|[1-9][0-9]*)\.[0-9]{2}$/;

export function validateConfig({ ajv, dir, fail, customers, users }) {
  const read = (p) => JSON.parse(fs.readFileSync(path.join(dir, p), "utf8"));
  ajv.addSchema(read("schema/config.json"));
  const check = (def, value, label) => {
    const validate = ajv.getSchema(`config.json#/$defs/${def}`);
    if (!validate(value))
      for (const e of validate.errors) fail(`${label}${e.instancePath}: ${e.message}`);
  };

  // --- Registry
  const types = read("config/document-types.json");
  check("document_types", types, "config/document-types.json");
  const registry = new Map(types.map((t) => [t.key, t]));
  if (registry.size !== types.length) fail("document-types: duplicate key");
  const builtin = types.filter((t) => t.builtin).map((t) => t.key);
  if (builtin.join() !== "invoice,order,delivery")
    fail(`document-types: builtin must be invoice,order,delivery`);
  for (const t of types) {
    const keys = [
      ...t.extraction.fields,
      ...t.extraction.tables,
      ...t.extraction.transaction_lists,
    ].map((x) => x.key);
    if (new Set(keys).size !== keys.length) fail(`${t.key}: duplicate field/table key`);
    for (const l of t.extraction.transaction_lists)
      for (const c of ["date", "amount", "direction", "counterparty"])
        if (!l.columns.some((x) => x.key === c))
          fail(`${t.key}.${l.key}: transaction list needs column ${c}`);
  }
  const fieldDef = (type, field) => {
    const t = registry.get(type);
    const [top, part] = field.split(".");
    const f = t?.extraction.fields.find((x) => x.key === top);
    if (!f) return null;
    if (part !== undefined && (f.type !== "party" || !PARTY_PARTS.has(part))) return null;
    return part ? { ...f, type: "text" } : f;
  };
  const listDef = (type, key) => {
    const x = registry.get(type)?.extraction;
    return x && [...x.tables, ...x.transaction_lists].find((l) => l.key === key);
  };

  // --- Check library
  const library = read("config/check-library.json");
  check("check_library", library, "config/check-library.json");
  const families = new Map(library.families.map((f) => [f.type, f]));
  const legacy = library.legacy_rules.map((r) => r.rule_id).join();
  if (legacy !== "R-001,R-002,R-003,R-004,R-005,R-006,R-007,R-008,R-009")
    fail("check-library: legacy_rules must list R-001…R-009 in order");
  for (const r of library.legacy_rules)
    if (r.family !== null && !families.has(r.family))
      fail(`check-library: ${r.rule_id} → unknown family ${r.family}`);

  // --- Scenarios
  const userIds = new Set(users.map((u) => u.id));
  for (const name of SCENARIOS) {
    const label = `scenarios/${name}.json`;
    const s = read(`scenarios/${name}.json`);
    check("scenario", s, label);
    // the scenario customer is also in customers.json (seed, mock list): same set, plus legacy flags
    const listed = customers.find((c) => c.id === s.customer.id);
    if (listed && JSON.stringify(withoutFlags(listed)) !== JSON.stringify(s.customer))
      fail(`${label}: customer ${s.customer.id} differs from customers.json`);
    for (const rs of s.customer.requirement_sets)
      checkRequirementSet(rs, `${label} v${rs.version}`);
    for (const p of s.packages) checkPackage(p, s, label);
    const expected = read(`scenarios/${name}.expected.json`);
    const refs = s.packages
      .map((p) => p.reference)
      .sort()
      .join();
    if (Object.keys(expected.packages).sort().join() !== refs)
      fail(`${name}.expected.json must list exactly the scenario packages`);
    const checkIds = [
      "D-001",
      ...s.customer.requirement_sets.at(-1).checks.map((c) => c.id),
    ].join();
    for (const [ref, e] of Object.entries(expected.packages))
      if (Object.keys(e.results).join() !== checkIds)
        fail(`${name}.expected.json ${ref}: results must be ${checkIds}`);
  }

  function withoutFlags(c) {
    const flags = ["require_po", "require_delivery", "require_signature", "tolerance"];
    const sets = c.requirement_sets.map((rs) =>
      Object.fromEntries(Object.entries(rs).filter(([k]) => !flags.includes(k))),
    );
    return { ...c, requirement_sets: sets };
  }

  function checkRequirementSet(rs, label) {
    if (!userIds.has(rs.approved_by)) fail(`${label}: unknown approver ${rs.approved_by}`);
    const docTypes = new Map(rs.documents.map((d) => [d.type, d]));
    for (const d of rs.documents) {
      if (!registry.has(d.type)) fail(`${label}: unknown document type ${d.type}`);
      if (d.max_count !== null && d.max_count < d.min_count)
        fail(`${label}: ${d.type} max_count < min_count`);
    }
    const ids = rs.checks.map((c) => c.id);
    if (new Set(ids).size !== ids.length) fail(`${label}: duplicate check id`);
    const present = new Set();
    for (const c of rs.checks) {
      const fam = families.get(c.type);
      if (!fam || fam.system) fail(`${label} ${c.id}: ${c.type} is not a configurable family`);
      if (c.id.startsWith("R-") || c.id === "D-001")
        fail(`${label} ${c.id}: R-/D-001 ids are reserved`);
      for (const p of fam?.parameters ?? [])
        if (p.required && !(p.name in c.parameters))
          fail(`${label} ${c.id}: missing parameter ${p.name}`);
      for (const k of Object.keys(c.parameters))
        if (fam && !fam.parameters.some((p) => p.name === k))
          fail(`${label} ${c.id}: unknown parameter ${k}`);
      walkRefs(c.parameters, (ref) => {
        if (!docTypes.has(ref.document_type))
          fail(`${label} ${c.id}: ${ref.document_type} not in documents[]`);
        if (ref.field && !fieldDef(ref.document_type, ref.field))
          fail(`${label} ${c.id}: unknown field ${ref.document_type}.${ref.field}`);
        if (ref.list && !listDef(ref.document_type, ref.list))
          fail(`${label} ${c.id}: unknown list ${ref.document_type}.${ref.list}`);
      });
      const P = c.parameters;
      const hasColumn = (type, list, col) =>
        listDef(type, list)?.columns.some((x) => x.key === col);
      const columns = (type, list, cols) => {
        for (const col of cols)
          if (!hasColumn(type, list, col))
            fail(`${label} ${c.id}: unknown column ${type}.${list}.${col}`);
      };
      if (c.type === "totals_sum") columns(P.document_type, P.table, [P.amount_column]);
      if (c.type === "line_items_match")
        for (const side of [P.left, P.right])
          columns(side.document_type, side.table, [P.key_column, ...P.compare]);
      if (c.type === "transaction_match")
        for (const a of P.against)
          columns(a.document_type, a.list, ["date", "amount", "direction", "counterparty"]);
      if (c.type === "date_within_period")
        for (const b of [P.period.from, P.period.to])
          if (typeof b === "object" && docTypes.get(b.document_type)?.max_count !== 1)
            fail(`${label} ${c.id}: a period bound needs a document type with max_count 1`);
      if (c.type === "field_present")
        for (const t of c.parameters.targets) present.add(`${t.document_type}.${t.field}`);
    }
    const names = (rs.output?.placeholders ?? []).map((x) => x.placeholder);
    if (new Set(names).size !== names.length) fail(`${label}: a placeholder is mapped twice`);
    for (const { placeholder, source } of rs.output?.placeholders ?? []) {
      if (source.kind === "field") {
        if (docTypes.get(source.document_type)?.max_count !== 1)
          fail(`${label} ${placeholder}: field source needs a document type with max_count 1`);
        if (!present.has(`${source.document_type}.${source.field}`))
          fail(
            `${label} ${placeholder}: ${source.document_type}.${source.field} must be a field_present target`,
          );
      }
      if (
        source.kind === "aggregate" &&
        source.op === "sum" &&
        fieldDef(source.document_type, source.field ?? "")?.type !== "money"
      )
        fail(`${label} ${placeholder}: sum needs a money field`);
    }
  }

  function walkRefs(value, visit) {
    if (Array.isArray(value)) return value.forEach((v) => walkRefs(v, visit));
    if (value && typeof value === "object") {
      if (typeof value.document_type === "string") {
        const field = value.field ?? value.amount_field;
        visit({ document_type: value.document_type, field, list: value.list ?? value.table });
        for (const k of ["date_field", "counterparty_field", "total_field"])
          if (value[k]) visit({ document_type: value.document_type, field: value[k] });
        for (const k of value.key_fields ?? [])
          visit({ document_type: value.document_type, field: k });
      }
      for (const v of Object.values(value)) if (v && typeof v === "object") walkRefs(v, visit);
    }
  }

  function checkPackage(p, s, label) {
    const at = `${label} ${p.reference}`;
    if (p.customer_id !== s.customer.id) fail(`${at}: customer must be ${s.customer.id}`);
    if (!userIds.has(p.owner_id)) fail(`${at}: unknown owner`);
    const docIds = new Set();
    for (const d of p.documents) {
      if (docIds.has(d.id)) fail(`${at}: duplicate document id ${d.id}`);
      docIds.add(d.id);
      const t = registry.get(d.type);
      if (!t) {
        fail(`${at} ${d.id}: unknown type ${d.type}`);
        continue;
      }
      for (const [k, v] of Object.entries(d.fields)) {
        const f = fieldDef(d.type, k);
        if (!f) fail(`${at} ${d.id}: field ${k} not in registry`);
        else if (v !== null && f.type === "money" && !MONEY.test(v))
          fail(`${at} ${d.id}.${k}: money must be a 2-decimal string`);
        if (v !== null && !d.evidence[k])
          fail(`${at} ${d.id}.${k}: extracted value without evidence`);
        if (v !== null && d.unreadable.includes(k))
          fail(`${at} ${d.id}.${k}: unreadable field must be null`);
      }
      for (const [key, rows] of Object.entries(d.tables)) {
        const l = listDef(d.type, key);
        if (!l) fail(`${at} ${d.id}: table ${key} not in registry`);
        rows.forEach((row, i) => {
          if (!d.evidence[`${key}[${i}]`]) fail(`${at} ${d.id}.${key}[${i}]: row without evidence`);
          for (const [c, v] of Object.entries(row)) {
            const col = l?.columns.find((x) => x.key === c);
            if (!col) fail(`${at} ${d.id}.${key}[${i}]: column ${c} not in registry`);
            else if (col.type === "money" && !MONEY.test(v))
              fail(`${at} ${d.id}.${key}[${i}].${c}: bad money`);
          }
        });
      }
      for (const e of Object.values(d.evidence))
        if (e.page > d.pages) fail(`${at} ${d.id}: evidence page beyond document`);
    }
  }

  return { scenarios: SCENARIOS.length, types: types.length };
}
