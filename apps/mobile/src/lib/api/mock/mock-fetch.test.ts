import { ApiError, unwrap } from "@payproof/api-client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockFileVersion } from "@/lib/api/mock-file";
import { mockPaper } from "@/lib/mock-paper/paper";
import { mockClient, pkgId } from "@/test/mock";

import { createMockFetch, mockApi } from "./mock-fetch";

const fail = (p: Promise<unknown>) =>
  p.then(
    () => undefined,
    (e: unknown) => e,
  );

describe("createMockFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("answers with the shared demo company and its permissions", async () => {
    const get = (slug: string) =>
      unwrap(
        mockClient(slug).GET("/v1/packages/{package_id}", {
          params: { path: { package_id: pkgId("pkg_1038") } },
        }),
      );
    expect((await get("u2")).permissions.can_approve).toBe(true);
    expect((await get("u1")).permissions.can_approve).toBe(false);
    expect(await fail(unwrap(mockClient(null).GET("/v1/me")))).toMatchObject({ status: 401 });
  });

  it("answers unknown endpoints with a contract 404", async () => {
    const res = await createMockFetch()(new Request("http://localhost:8000/v1/nope"));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("fails like the network does while the device is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const error = await fail(unwrap(mockClient().GET("/v1/me")));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("keeps one demo company per page, so writes show up in later reads", async () => {
    expect(mockApi()).toBe(mockApi());
    const unread = () =>
      unwrap(mockClient("u1").GET("/v1/notifications")).then((p) => p.unread_count);
    expect(await unread()).toBeGreaterThan(0);
    await unwrap(mockClient("u1").POST("/v1/notifications/read-all"));
    expect(await unread()).toBe(0);
  });
});

describe("mock file links", () => {
  it("are drawn as paper for the document version they name", async () => {
    const detail = await unwrap(
      mockClient().GET("/v1/packages/{package_id}", {
        params: { path: { package_id: pkgId("pkg_1042") } },
      }),
    );
    const version = detail.documents[0]!.current.id;
    const link = await unwrap(
      mockClient().GET("/v1/documents/versions/{version_id}/file", {
        params: { path: { version_id: version } },
      }),
    );
    expect(mockFileVersion(link.url)).toBe(version);
    expect(mockPaper(version)?.pages[0]?.number).toBe("INV-1042");
  });

  it("are told apart from real file URLs", () => {
    expect(mockFileVersion("https://files.example/abc.pdf?sig=1")).toBeNull();
  });
});
