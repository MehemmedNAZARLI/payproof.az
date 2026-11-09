"use client";

import { useState } from "react";

import { AppHeader } from "@/components/ui/app-header";
import { Badge, CheckOutcomeBadge, PackageStatusBadge } from "@/components/ui/badge";
import { Card, SectionHeader } from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/format";

import {
  displayValue,
  grantCheckLabels,
  grantCustomer,
  type GrantDocument,
  grants,
  type Source,
} from "./data";

const docType: Record<string, string> = {
  invoice: "Invoice",
  bank_statement: "Bank statement",
  card_statement: "Card statement",
};
function Quote({ source }: { source: Source | undefined }) {
  return source ? (
    <blockquote className="text-text-2 mt-2 border-l-2 border-accent/30 pl-3 text-caption">
      <span className="text-accent block font-semibold">Source · p. {source.page}</span>
      <q>{source.quote}</q>
    </blockquote>
  ) : (
    <p className="text-text-3 text-caption">No source available</p>
  );
}

function DocumentFields({ doc }: { doc: GrantDocument }) {
  return (
    <details className="bg-surface mb-3 rounded-lg p-4 shadow-1">
      <summary className="min-h-11 cursor-pointer text-subhead font-semibold">
        {docType[doc.type] ?? doc.type} · {doc.file_name}
      </summary>
      {Object.entries(doc.fields).map(([key, value]) => (
        <div key={key} className="border-separator border-t py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-text-3 text-caption capitalize">{key.replaceAll("_", " ")}</span>
            <Badge tone={value === null || doc.unreadable.includes(key) ? "warning" : "accent"}>
              {value === null || doc.unreadable.includes(key) ? "Unknown" : "AI"}
            </Badge>
          </div>
          <p className="mt-1 break-words text-footnote font-medium">
            {doc.unreadable.includes(key)
              ? "Unknown"
              : typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
                ? formatDate(value)
                : displayValue(value)}
          </p>
          <Quote source={doc.evidence[key]} />
        </div>
      ))}
      {Object.entries(doc.tables).flatMap(([table, rows]) =>
        (rows ?? []).map((row, index) => (
          <div key={`${table}-${index}`} className="border-separator border-t py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-text-3 text-caption">
                {table === "transactions" ? "Transaction" : "Invoice line"} {index + 1}
              </span>
              <Badge tone="accent">AI</Badge>
            </div>
            <p className="mt-1 break-words text-footnote">{displayValue(row)}</p>
            <Quote source={doc.evidence[`${table}[${index}]`]} />
          </div>
        )),
      )}
    </details>
  );
}

export function GrantsScreen() {
  const [selected, setSelected] = useState(0);
  const pkg = grants[selected]!;
  const results = Object.entries(pkg.expected.results);
  const passed = results.filter(([, outcome]) => outcome === "PASS").length;
  const matching = pkg.expected.data["U-07"];
  const total = pkg.expected.data["U-06"].total;
  return (
    <>
      <AppHeader
        title="UNEC student grant"
        subtitle="Customer document requirements"
        back={{ href: "/packages", label: "Packages" }}
      />
      <main className="px-safe pb-safe mx-auto max-w-app pt-3">
        <Card className="hero p-5">
          <p className="text-hero-text2 text-footnote">{grantCustomer.name}</p>
          <h1 className="mt-2 text-title2 font-bold">From expense documents to a grant act.</h1>
          <p className="text-hero-text2 mt-3 text-footnote">
            Required: 1–10 invoices, one bank statement and one card statement. Rules verify
            identity, totals, reporting dates and transaction matches.
          </p>
        </Card>
        <SectionHeader title="Grant packages" />
        <div className="flex flex-col gap-2" aria-label="Grant packages">
          {grants.map((p, index) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
              className={`bg-surface min-h-18 rounded-lg p-4 text-left shadow-1 ${selected === index ? "ring-2 ring-accent" : ""}`}
            >
              <span className="flex items-center justify-between gap-2">
                <b className="text-subhead">{p.reference}</b>
                <PackageStatusBadge status={p.expected.status} />
              </span>
              <span className="text-text-3 mt-1 block text-caption">
                {Object.keys(p.expected.results).length} checks ·{" "}
                {
                  Object.values(p.expected.results).filter((r) => r === "FAIL" || r === "UNKNOWN")
                    .length
                }{" "}
                issues · AI-read
              </span>
            </button>
          ))}
        </div>
        <Card className="mt-5 p-5">
          <h2 className="text-subhead font-semibold">AI document review · {pkg.reference}</h2>
          <p className="text-text-2 mt-2 text-footnote">
            AI read {pkg.documents.length} documents and extracted{" "}
            {pkg.documents.reduce(
              (n, d) =>
                n +
                Object.keys(d.fields).filter(
                  (key) => d.fields[key] !== null && !d.unreadable.includes(key),
                ).length,
              0,
            )}{" "}
            fields. {passed} checks passed, {results.length - passed} need attention. Source pages
            and quotes are shown below.
          </p>
          <p className="mt-3 text-title2 font-bold tabular-nums">
            {formatMoney(total.amount, total.currency)}
          </p>
        </Card>
        <SectionHeader title="Statement transaction matching" />
        {matching.matches.map((match) => {
          const invoice = pkg.documents.find((d) => d.id === match.document_id)!;
          const statement = pkg.documents.find((d) => d.id === match.transaction.document_id)!;
          const transaction = statement.tables.transactions![match.transaction.index]!;
          return (
            <Card key={match.document_id} className="mb-3 p-4">
              <div className="flex items-center justify-between">
                <b className="text-subhead">{displayValue(invoice.fields.invoice_number)}</b>
                <Badge tone="success">Matched</Badge>
              </div>
              <p className="text-text-2 mt-2 text-footnote">
                {docType[statement.type]} · transaction {match.transaction.index + 1}
              </p>
              <p className="mt-1 text-footnote">
                {formatDate(transaction.date)} · {formatMoney(transaction.amount, pkg.currency)}
              </p>
              <Quote source={invoice.evidence.total} />
              <Quote source={statement.evidence[`transactions[${match.transaction.index}]`]} />
            </Card>
          );
        })}
        {matching.unmatched.map((issue) => {
          const invoice = pkg.documents.find((d) => d.id === issue.document_id)!;
          return (
            <Card key={issue.document_id} className="mb-3 p-4">
              <Badge tone="danger">No matching transaction</Badge>
              <p className="mt-2 text-subhead font-semibold">
                {displayValue(invoice.fields.invoice_number)} ·{" "}
                {formatMoney(issue.amount.amount, issue.amount.currency)}
              </p>
              <p className="text-text-2 mt-2 text-footnote">
                Nearest transaction:{" "}
                {formatMoney(issue.nearest.amount.amount, issue.nearest.amount.currency)}.
                Difference:{" "}
                {formatMoney(issue.nearest.difference.amount, issue.nearest.difference.currency)}.
                Approval is blocked.
              </p>
              <Quote source={invoice.evidence.total} />
            </Card>
          );
        })}
        <SectionHeader title="Deterministic checks" />
        <Card className="p-4">
          {results.map(([id, outcome]) => (
            <div key={id} className="flex items-center justify-between gap-3 py-2">
              <p className="text-footnote">
                {id} · {grantCheckLabels[id]}
              </p>
              <CheckOutcomeBadge outcome={outcome} />
            </div>
          ))}
        </Card>
        <SectionHeader title="Extracted fields and sources" />
        {pkg.documents.map((doc) => (
          <DocumentFields key={doc.id} doc={doc} />
        ))}
        <SectionHeader title="Customer’s output form" />
        <Card className="mb-6 p-5">
          <h2 className="text-subhead font-semibold">Grant expense act</h2>
          {pkg.expected.template_values && (
            <dl className="my-3 space-y-2">
              {Object.entries(pkg.expected.template_values).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-text-3 text-caption capitalize">
                    {key.replaceAll(/[{}]/g, "").replaceAll("_", " ")}
                  </dt>
                  <dd className="text-footnote font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="text-text-2 mt-2 text-footnote">
            After human approval, PayProof fills the customer’s act and prepares submission to{" "}
            {grantCustomer.requirements.output.submission.address}.
          </p>
          <p className="text-text-3 mt-3 text-caption">
            Synthetic scenario preview. Approval and submission for configured document sets are not
            connected in this mobile demo.
          </p>
        </Card>
      </main>
    </>
  );
}
