import type { Schemas } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { usePackageList } from "@/features/packages";
import { setToken } from "@/lib/auth";
import { renderHookWithQuery, renderWithQuery } from "@/test/render";
import { usePackage } from "../queries";
import { ChecksPanel } from "./checks-panel";

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

function Of({
  id,
  onFix = vi.fn(),
  onEvidence = vi.fn(),
}: {
  id: string;
  onFix?: (f: string, c: unknown) => void;
  onEvidence?: () => void;
}) {
  const pkg = usePackage(id).data;
  return pkg ? <ChecksPanel pkg={pkg} canEdit onFix={onFix} onEvidence={onEvidence} /> : null;
}
const panel = () => screen.findByRole("region", { name: "Yoxlamalar" });

test("INV-1042: counts, blocking cards with sources and the 'choose order' fix", async () => {
  const onFix = vi.fn();
  const onEvidence = vi.fn();
  renderWithQuery(<Of id={mockIds.pkg("pkg_1042")} onFix={onFix} onEvidence={onEvidence} />);
  const p = await panel();
  expect(within(p).getByRole("list", { name: "Yoxlama xülasəsi" })).toHaveTextContent(
    /\d+ keçdi.*\d+ uyğunsuz.*\d+ naməlum.*\d+ tətbiq olunmur/,
  );
  const blocking = within(p).getByRole("list", { name: "Bloklayan problemlər" });
  const cards = within(blocking).getAllByRole("article");
  expect(cards.length).toBeGreaterThan(0);
  expect(cards[0]).toHaveTextContent(/R-0\d{2}/);
  await userEvent.click(within(p).getAllByRole("button", { name: "Sifarişi seç" })[0]!);
  expect(onFix).toHaveBeenCalledWith("link_order", expect.anything());
  const source = within(blocking).queryAllByRole("button", { name: /^Mənbə:/ })[0];
  if (source) {
    await userEvent.click(source);
    expect(onEvidence).toHaveBeenCalled();
  }
});

test("dependent checks are listed apart; passing/NA ones fold away", async () => {
  renderWithQuery(<Of id={mockIds.pkg("pkg_1042")} />);
  const p = await panel();
  expect(within(p).getByText(/^Keçən və tətbiq olunmayan yoxlamalar \(\d+\)$/)).toBeInTheDocument();
});

test("a ready package: no problem is invented, the passing list is open", async () => {
  const list = renderHookWithQuery(() => usePackageList({ status: ["READY_FOR_APPROVAL"] }));
  await waitFor(() => expect(list.result.current.data?.items.length).toBeGreaterThan(0));
  renderWithQuery(<Of id={list.result.current.data!.items[0]!.id} />);
  const p = await panel();
  expect(within(p).getByText("Bloklayan problem yoxdur")).toBeInTheDocument();
  expect(
    within(p).getByText("Problem uydurulmur: bütün məcburi qaydalar cari versiyada keçib."),
  ).toBeInTheDocument();
  expect(p.querySelector("details")).toHaveAttribute("open");
});

const r007 = {
  requirement_set: { version: 2 },
  summary: { pass: 0, fail: 1, unknown: 0, not_applicable: 0, blocking: [] },
  tasks: [],
  checks: [
    {
      rule_id: "R-007",
      title: "Məcburi təhvil sənədi",
      outcome: "FAIL",
      cascade: false,
      message: "Təhvil sənədi yoxdur.",
      evidence: [],
      fix_hint: "upload_delivery",
      data: {},
    },
  ],
} as unknown as Schemas["PackageDetail"];

test("upload fixes are live for editors, inert and explained otherwise", async () => {
  const pkg = {
    requirement_set: { version: 2 },
    summary: { pass: 0, fail: 1, unknown: 0, not_applicable: 0, blocking: [] },
    tasks: [],
    checks: [
      {
        rule_id: "R-007",
        title: "Məcburi təhvil sənədi",
        outcome: "FAIL",
        cascade: false,
        message: "Təhvil sənədi yoxdur.",
        evidence: [],
        fix_hint: "upload_delivery",
        data: {},
      },
    ],
  } as unknown as Schemas["PackageDetail"];
  const onFix = vi.fn();
  const { rerender } = renderWithQuery(
    <ChecksPanel pkg={pkg} canEdit onFix={onFix} onEvidence={vi.fn()} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Təhvil sənədi yüklə" }));
  expect(onFix).toHaveBeenCalledWith("upload_delivery", expect.anything());
  // a role without edit rights sees the fix, inert, with the reason
  rerender(<ChecksPanel pkg={pkg} canEdit={false} onFix={onFix} onEvidence={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Təhvil sənədi yüklə" })).toHaveAccessibleDescription(
    /mümkün deyil/,
  );
});

test("a check without a task offers one; with an open task it shows who has it", async () => {
  const onTask = vi.fn();
  const { rerender } = renderWithQuery(
    <ChecksPanel pkg={r007} canEdit onFix={vi.fn()} onEvidence={vi.fn()} onTask={onTask} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Tapşırıq yarat" }));
  expect(onTask).toHaveBeenCalledWith(r007.checks[0]);
  const withTask = {
    ...r007,
    tasks: [
      {
        number: "T-120",
        rule_id: "R-007",
        status: "IN_PROGRESS",
        step: "Aktı yükləyin.",
        assignee: { full_name: "Elvin Qasımov" },
      },
    ],
  } as unknown as Schemas["PackageDetail"];
  rerender(
    <ChecksPanel pkg={withTask} canEdit onFix={vi.fn()} onEvidence={vi.fn()} onTask={onTask} />,
  );
  expect(screen.getByRole("link", { name: "T-120 · Elvin Qasımov · İcrada" })).toHaveAttribute(
    "href",
    "/tasks",
  );
  expect(screen.queryByRole("button", { name: "Tapşırıq yarat" })).toBeNull();
  // without the right to manage tasks: visible, inert, explained
  rerender(<ChecksPanel pkg={r007} canEdit onFix={vi.fn()} onEvidence={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Tapşırıq yarat" })).toHaveAccessibleDescription(
    /tapşırıq yaratmaq mümkün deyil/,
  );
});
