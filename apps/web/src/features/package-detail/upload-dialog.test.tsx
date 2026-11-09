import { ApiError } from "@payproof/api-client";
import { mockIds } from "@payproof/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderHookWithQuery, renderWithQuery, testQueryClient } from "@/test/render";
import { UploadDialog } from "./components/upload-dialog";
import { usePackage } from "./queries";

// multipart cannot run in jsdom (see upload-request.test.ts): the request is stubbed here
const mutate = vi.fn();
const job = vi.fn(() => ({ data: undefined, isError: false }) as unknown);
vi.mock("./mutations", async (orig) => ({
  ...(await orig<typeof import("./mutations")>()),
  useUploadDocument: () => ({ mutate, isPending: false }),
  useJob: () => job(),
}));

beforeEach(() => {
  setToken(`mock.${mockIds.user("u1")}`);
  vi.stubEnv("NEXT_PUBLIC_API_MOCK", "1");
  mutate.mockReset();
  job.mockReset().mockReturnValue({ data: undefined, isError: false });
});

const onOpenChange = vi.fn();
async function open() {
  onOpenChange.mockReset();
  const client = testQueryClient();
  const q = renderHookWithQuery(() => usePackage(mockIds.pkg("pkg_1042")), client);
  await waitFor(() => expect(q.result.current.data).toBeDefined());
  const pkg = q.result.current.data!;
  renderWithQuery(
    <UploadDialog pkg={pkg} open onOpenChange={onOpenChange} initialType="invoice" />,
    client,
  );
  return pkg;
}

test("a file is required", async () => {
  await open();
  await userEvent.click(screen.getByRole("button", { name: /Yüklə və emal et/ }));
  expect(screen.getByRole("alert")).toHaveTextContent("Fayl seçin.");
  expect(mutate).not.toHaveBeenCalled();
});

test("a new invoice version goes to the existing document with one key per intent", async () => {
  const pkg = await open();
  await userEvent.click(screen.getByRole("radio", { name: /INV-1042_v2_PO-381\.pdf/ }));
  const submit = screen.getByRole("button", { name: /Yüklə və emal et/ });
  await userEvent.click(submit);
  const [input] = mutate.mock.calls[0]!;
  expect(input).toMatchObject({
    type: "invoice",
    expectedVersion: pkg.version,
    documentId: pkg.documents.find((d) => d.type === "invoice")!.id,
  });
  expect(input.file.name).toBe("INV-1042_v2_PO-381.pdf");
  await userEvent.click(submit); // a retry of the same intent reuses the key
  expect(mutate.mock.calls[1]![0].idempotencyKey).toBe(input.idempotencyKey);
});

test("a duplicate is flagged and the refusal says no version was created", async () => {
  await open();
  const dup = screen.getByRole("radio", { name: /^INV-1042\.pdf/ });
  expect(dup.closest("label")).toHaveTextContent("Təkrar fayl");
  mutate.mockImplementation((_input, { onError }) =>
    onError(new ApiError("DUPLICATE_FILE", "dup", 409)),
  );
  await userEvent.click(dup);
  await userEvent.click(screen.getByRole("button", { name: /Yüklə və emal et/ }));
  expect(await screen.findByText(/yeni versiya yaradılmadı/)).toBeInTheDocument();
});

test("a version conflict offers to reload", async () => {
  await open();
  mutate.mockImplementation((_input, { onError }) =>
    onError(new ApiError("VERSION_CONFLICT", "stale", 409)),
  );
  await userEvent.click(screen.getByRole("radio", { name: /INV-1042_v2_PO-381\.pdf/ }));
  await userEvent.click(screen.getByRole("button", { name: /Yüklə və emal et/ }));
  expect(await screen.findByText(/Paket yenilənib/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Yenilə" })).toBeInTheDocument();
});

test("after a conflict the retry is a new intent with a new key", async () => {
  await open();
  mutate.mockImplementationOnce((_input, { onError }) =>
    onError(new ApiError("VERSION_CONFLICT", "stale", 409)),
  );
  await userEvent.click(screen.getByRole("radio", { name: /INV-1042_v2_PO-381\.pdf/ }));
  const submit = screen.getByRole("button", { name: /Yüklə və emal et/ });
  await userEvent.click(submit);
  await userEvent.click(await screen.findByRole("button", { name: "Yenilə" }));
  await userEvent.click(submit);
  const [first, second] = mutate.mock.calls.map(([input]) => input.idempotencyKey);
  expect(second).not.toBe(first);
});

test("a job that cannot be polled is reported and the dialog can still be closed", async () => {
  mutate.mockImplementation((_input, { onSuccess }) => onSuccess({ job_id: "j1" }));
  job.mockReturnValue({ data: undefined, isError: true });
  await open();
  await userEvent.click(screen.getByRole("radio", { name: /INV-1042_v2_PO-381\.pdf/ }));
  await userEvent.click(screen.getByRole("button", { name: /Yüklə və emal et/ }));
  expect(await screen.findByText("Emalın vəziyyətini almaq olmadı.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Ləğv et" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
