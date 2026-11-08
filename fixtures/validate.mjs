// Validates fixtures/*.json against fixtures/schema/*.json plus cross-file invariants.
// Run: pnpm fixtures:check
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(fs.readFileSync(path.join(dir, p), "utf8"));
const FILES = [
  "company",
  "users",
  "customers",
  "products",
  "orders",
  "packages",
  "tasks",
  "notifications",
  "samples",
  "newsets",
  "expected",
];

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(read("schema/defs.json"));
const errors = [];
const fail = (msg) => errors.push(msg);

const data = {};
for (const name of FILES) {
  data[name] = read(`${name}.json`);
  const validate = ajv.compile(read(`schema/${name}.json`));
  if (!validate(data[name]))
    for (const e of validate.errors) fail(`${name}.json${e.instancePath}: ${e.message}`);
}
const {
  users,
  customers,
  products,
  orders,
  packages,
  tasks,
  notifications,
  samples,
  newsets,
  expected,
} = data;

// Money in integer cents — never float.
const cents = (s) => {
  const [int, frac] = s.replace("-", "").split(".");
  return (s.startsWith("-") ? -1n : 1n) * (BigInt(int) * 100n + BigInt(frac));
};
const fromCents = (c) =>
  `${c < 0n ? "-" : ""}${(c < 0n ? -c : c) / 100n}.${String((c < 0n ? -c : c) % 100n).padStart(2, "0")}`;
const lineSum = (lines) => lines.reduce((a, l) => a + BigInt(l.qty) * cents(l.unit_price), 0n);

// Counts
const actual = {
  packages: packages.length,
  orders: orders.length,
  customers: customers.length,
  users: users.length,
  products: products.length,
  tasks: tasks.length,
  samples: samples.length,
  newsets: newsets.length,
};
for (const [k, n] of Object.entries(expected.counts))
  if (actual[k] !== n) fail(`count ${k}: expected ${n}, got ${actual[k]}`);

// Referential integrity
const ids = (arr, key) => new Set(arr.map((x) => x[key]));
const userById = new Map(users.map((u) => [u.id, u]));
const customerById = new Map(customers.map((c) => [c.id, c]));
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const userIds = ids(users, "id"),
  customerIds = ids(customers, "id"),
  codes = ids(products, "code"),
  pos = ids(orders, "po_number"),
  pkgIds = ids(packages, "id");
const ref = (set, v, where) =>
  v != null && v !== "system" && !set.has(v) && fail(`${where}: unknown reference ${v}`);
const unique = (arr, key, file) =>
  arr.length !== ids(arr, key).size && fail(`${file}: duplicate ${key}`);
unique(users, "id", "users");
unique(customers, "id", "customers");
unique(products, "code", "products");
unique(orders, "po_number", "orders");
unique(packages, "id", "packages");
unique(packages, "invoice_number", "packages");
unique(tasks, "number", "tasks");

for (const c of customers) {
  c.requirement_sets.forEach((r, i) => {
    if (r.version !== i + 1) fail(`${c.id}: requirement set versions must be 1..n`);
    ref(userIds, r.approved_by, `${c.id} rules v${r.version}`);
  });
}
for (const o of orders) {
  ref(customerIds, o.customer_id, o.po_number);
  o.lines.forEach((l) => ref(codes, l.product_code, o.po_number));
}
for (const p of packages) {
  const w = p.invoice_number;
  ref(customerIds, p.customer_id, w);
  ref(userIds, p.owner_id, w);
  p.invoice.lines.forEach((l) => ref(codes, l.product_code, w));
  ref(pos, p.order_link.po_number, `${w} order_link`);
  ref(userIds, p.order_link.confirmed_by, `${w} order_link`);
  if (p.order_link.confirmed !== (p.order_link.method !== null))
    fail(`${w}: link method must be set iff confirmed`);
  p.candidates.forEach((c) => ref(pos, c.po_number, `${w} candidate`));
  if (p.delivery) {
    ref(pos, p.delivery.po_ref, `${w} delivery`);
    ref(customerIds, p.delivery.customer_id, `${w} delivery`);
  }
  if (cents(p.invoice.total) !== lineSum(p.invoice.lines))
    fail(
      `${w}: invoice total ${p.invoice.total} != sum of lines ${fromCents(lineSum(p.invoice.lines))}`,
    );
  for (const d of p.documents)
    d.versions.forEach((v, i) => {
      if (v.version_no !== i + 1) fail(`${w} ${d.type}: version_no must be 1..n`);
      ref(userIds, v.uploaded_by, w);
    });
  for (const d of p.documents)
    for (const v of d.versions)
      if (v.sha256 !== sha(v.file_name))
        fail(`${w} ${v.file_name}: sha256 must be sha256(file_name)`);
  const ruleVersions = new Set(
    customerById.get(p.customer_id)?.requirement_sets.map((r) => r.version),
  );
  for (const a of p.approvals) {
    ref(userIds, a.approver_id, `${w} approval`);
    if (userById.get(a.approver_id)?.role !== "approver")
      fail(`${w}: approval by non-approver ${a.approver_id}`);
    if (!ruleVersions.has(a.requirement_set_version))
      fail(`${w}: approval for unknown requirement set v${a.requirement_set_version}`);
    if (a.valid && a.package_version !== p.version)
      fail(`${w}: a valid approval must be for the current version`);
    if (a.valid === (a.invalidated_reason !== null) || a.valid === (a.invalidated_at !== null))
      fail(`${w}: invalidated_reason/at must be set iff approval is invalid`);
  }
  for (const e of p.exports) {
    ref(userIds, e.created_by, `${w} export`);
    const ok = p.approvals.some(
      (a) =>
        a.valid &&
        a.package_version === e.package_version &&
        a.requirement_set_version === e.requirement_set_version,
    );
    if (!ok)
      fail(
        `${w}: export without a valid approval for v${e.package_version}/rules v${e.requirement_set_version}`,
      );
  }
}
for (const t of tasks) {
  ref(pkgIds, t.package_id, t.number);
  ref(userIds, t.assignee_id, t.number);
  ref(userIds, t.created_by, t.number);
}
for (const n of notifications) {
  ref(pkgIds, n.package_id, "notification");
  ref(userIds, n.user_id, "notification");
}
for (const s of samples) {
  ref(pkgIds, s.package_id, s.id);
  if (s.extraction.line) ref(codes, s.extraction.line.product_code, s.id);
  if (s.sha256 !== sha(s.file_name)) fail(`${s.id}: sha256 must be sha256(file_name)`);
}
for (const n of newsets) {
  ref(customerIds, n.customer_id, n.id);
  ref(pos, n.po_number, n.id);
  n.lines.forEach((l) => ref(codes, l.product_code, n.id));
}

// ADR-0008: assignees (and readonly) never act in the system, sign in or receive notifications
const CAN_ACT = new Set(["operator", "approver", "admin"]);
const mustAct = (id, where) => {
  if (id == null || id === "system") return;
  if (!CAN_ACT.has(userById.get(id)?.role))
    fail(`${where}: ${id} (${userById.get(id)?.role}) cannot act`);
};
for (const u of users)
  if (u.demo_login && u.role === "assignee") fail(`${u.id}: assignee in dev login`);
for (const p of packages) {
  const w = p.invoice_number;
  mustAct(p.owner_id, `${w} owner`);
  mustAct(p.order_link.confirmed_by, `${w} link`);
  p.documents.forEach((d) =>
    d.versions.forEach((v) => mustAct(v.uploaded_by, `${w} ${v.file_name}`)),
  );
  p.approvals.forEach((a) => mustAct(a.approver_id, `${w} approval`));
  p.exports.forEach((e) => mustAct(e.created_by, `${w} export`));
}
for (const c of customers)
  c.requirement_sets.forEach((r) => mustAct(r.approved_by, `${c.id} rules v${r.version}`));
for (const t of tasks) mustAct(t.created_by, `${t.number} created_by`);
for (const n of notifications)
  if (userById.get(n.user_id)?.role === "assignee") fail(`notification to assignee ${n.user_id}`);
for (const steps of Object.values(expected.flows))
  steps.forEach((x) => mustAct(x.actor, `flow ${x.step}`));

// expected.json ↔ packages
const byInv = new Map(packages.map((p) => [p.invoice_number, p]));
if (Object.keys(expected.packages).sort().join() !== [...byInv.keys()].sort().join())
  fail("expected.packages must list exactly the fixture packages");
for (const [inv, e] of Object.entries(expected.packages)) {
  const p = byInv.get(inv);
  if (!p) continue;
  if (e.package_id !== p.id || e.version !== p.version)
    fail(`${inv}: expected package_id/version disagree with packages.json`);
  for (const b of e.blockers)
    if (e.checks[b.rule_id] !== b.outcome)
      fail(`${inv}: blocker ${b.rule_id} disagrees with checks`);
  // R-005 price difference: Σ (invoice − order) × qty, in cents
  const order = orders.find((o) => o.po_number === p.order_link.po_number);
  const diff = order
    ? p.invoice.lines.reduce((a, l) => {
        const ol = order.lines.find((x) => x.product_code === l.product_code);
        return ol ? a + (cents(l.unit_price) - cents(ol.unit_price)) * BigInt(l.qty) : a;
      }, 0n)
    : 0n;
  const wantDiff = e.checks["R-005"] === "FAIL" ? fromCents(diff) : undefined;
  if (e.r005_diff !== wantDiff) fail(`${inv}: r005_diff ${e.r005_diff} != recomputed ${wantDiff}`);
}

// Duplicate uploads in flows must hit an existing version hash of that package
for (const [inv, steps] of Object.entries(expected.flows)) {
  const p = byInv.get(inv);
  const hashes = new Set(p?.documents.flatMap((d) => d.versions.map((v) => v.sha256)));
  for (const s of steps.filter((x) => x.duplicate)) {
    const sample = samples.find((x) => x.id === s.sample_id);
    if (!sample || !hashes.has(sample.sha256))
      fail(`${inv} ${s.step}: duplicate sample does not match an existing version`);
  }
}

// Dashboard: open problem amounts per currency (never mixed)
const open = new Map();
for (const [inv, e] of Object.entries(expected.packages)) {
  if (e.status !== "NEEDS_FIX" && e.status !== "NEEDS_REVIEW") continue;
  const p = byInv.get(inv);
  const cur = open.get(p.currency) ?? { amount: 0n, packages: 0 };
  open.set(p.currency, { amount: cur.amount + cents(p.invoice.total), packages: cur.packages + 1 });
}
const dash = expected.dashboard;
if (dash.open_problem_amounts.length !== open.size)
  fail(`dashboard: ${dash.open_problem_amounts.length} currencies listed, ${open.size} recomputed`);
for (const x of dash.open_problem_amounts) {
  const got = open.get(x.currency);
  if (!got || fromCents(got.amount) !== x.amount || got.packages !== x.packages)
    fail(
      `dashboard ${x.currency}: expected ${x.amount}/${x.packages}, recomputed ${got && fromCents(got.amount)}/${got?.packages}`,
    );
}
const counts = {};
for (const e of Object.values(expected.packages)) counts[e.status] = (counts[e.status] ?? 0) + 1;
if (
  JSON.stringify(Object.entries(counts).sort()) !==
  JSON.stringify(Object.entries(dash.status_counts).sort())
)
  fail(
    `dashboard.status_counts ${JSON.stringify(dash.status_counts)} != recomputed ${JSON.stringify(counts)}`,
  );
// Problem age in whole days: package creation date → demo "today" (prototype: problemSince = created date)
const day = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
const ages = Object.entries(expected.packages)
  .filter(([, e]) => e.status === "NEEDS_FIX" || e.status === "NEEDS_REVIEW")
  .map(([inv]) => ({ inv, d: day(expected.demo_now) - day(byInv.get(inv).created_at) }));
const longest = ages.reduce((a, x) => (x.d > a.d ? x : a), { inv: null, d: -1 });
const avg = (ages.reduce((a, x) => a + x.d, 0) / ages.length).toFixed(1);
if (dash.avg_problem_days !== avg)
  fail(`dashboard.avg_problem_days ${dash.avg_problem_days} != recomputed ${avg}`);
if (dash.longest_problem.invoice_number !== longest.inv || dash.longest_problem.days !== longest.d)
  fail(`dashboard.longest_problem != recomputed ${longest.inv}/${longest.d}`);

// expected.json ↔ docs/product/demo-dataset.md package table
const md = fs.readFileSync(path.join(dir, "../docs/product/demo-dataset.md"), "utf8");
const rows = [
  ...md.matchAll(/^\| (INV-\d+) \| (c\d) \| ([\d.,]+) (AZN|USD) \| ([A-Z_]+) \| ([^|]*) \|/gm),
];
if (rows.length !== packages.length)
  fail(`demo-dataset.md: expected ${packages.length} package rows, found ${rows.length}`);
for (const [, inv, cust, amount, cur, status, blockersCol] of rows) {
  const p = byInv.get(inv),
    e = expected.packages[inv];
  if (!p || !e) {
    fail(`demo-dataset.md: ${inv} not in fixtures`);
    continue;
  }
  if (
    p.customer_id !== cust ||
    p.currency !== cur ||
    p.invoice.total !== amount.replaceAll(".", "").replace(",", ".")
  )
    fail(`${inv}: customer/amount differs from demo-dataset.md`);
  if (e.status !== status) fail(`${inv}: status ${e.status} != demo-dataset.md ${status}`);
  const mdBlockers = [...blockersCol.matchAll(/(R-\d{3}) (FAIL|UNKNOWN)/g)]
    .map((m) => `${m[1]} ${m[2]}`)
    .join();
  if (mdBlockers !== e.blockers.map((b) => `${b.rule_id} ${b.outcome}`).join())
    fail(
      `${inv}: blockers [${e.blockers.map((b) => b.rule_id)}] != demo-dataset.md [${mdBlockers}]`,
    );
}

if (errors.length) {
  console.error(`✗ fixtures:check — ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `✓ fixtures:check — ${FILES.length} files valid, ${packages.length} packages match expected.json and demo-dataset.md`,
);
