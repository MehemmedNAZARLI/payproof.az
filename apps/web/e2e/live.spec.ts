import { expect, REAL, signIn, test, USERS } from "./fixtures";
import { API_URL } from "./stack";

const AYGUN = USERS.aygun;
const RASHAD = USERS.resad;
// mock mode: MSW answers any origin
const API = REAL ? API_URL : "http://localhost:8000";

// Two tabs: the mock worker syncs them over BroadcastChannel, the real API over its event stream.
test("Rəşad approves in his tab → Aygün's list updates without a refresh, with a toast", async ({
  context,
}) => {
  const aygun = await context.newPage();
  await signIn(aygun, AYGUN, "/packages?status=READY_FOR_APPROVAL");
  const rows = aygun.getByRole("table", { name: "Faktura paketləri" }).locator("tbody tr");
  await expect(rows).toHaveCount(2);

  const rashad = await context.newPage();
  await signIn(rashad, RASHAD, "/overview");
  await expect(rashad.getByRole("heading", { name: "İcmal" })).toBeVisible();
  // The approval UI is W-13; approve through the API from Rəşad's tab (his own mock worker).
  const invoice = await rashad.evaluate(async (api) => {
    const auth = { Authorization: `Bearer ${sessionStorage.getItem("payproof.token")}` };
    const list = await (
      await fetch(`${api}/v1/packages?status=READY_FOR_APPROVAL`, { headers: auth })
    ).json();
    const pkg = await (
      await fetch(`${api}/v1/packages/${list.items[0].id}`, { headers: auth })
    ).json();
    const res = await fetch(`${api}/v1/packages/${pkg.id}/approve`, {
      method: "POST",
      headers: {
        ...auth,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        expected_version: pkg.version,
        expected_requirement_set_version: pkg.requirement_set.version,
        documents_reviewed: true,
      }),
    });
    if (!res.ok) throw new Error(`approve ${res.status}`);
    return pkg.invoice_number as string;
  }, API);

  await aygun.bringToFront();
  await expect(rows).toHaveCount(1, { timeout: 2_000 }); // ≤ 2 s after the approval, no reload
  await expect(aygun.getByText(`Rəşad Əliyev ${invoice} paketini təsdiqlədi`)).toBeVisible();
  await expect(rashad.getByText(/paketini təsdiqlədi/)).toHaveCount(0); // no toast for one's own change
});
