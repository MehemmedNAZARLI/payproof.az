import { describe, expect, it } from "vitest";

import { isPrivateRequest } from "./sw-policy";

const origin = "https://m.payproof.az";
const at = (href: string) => {
  const url = new URL(href, origin);
  return isPrivateRequest({ url, sameOrigin: url.origin === origin });
};

describe("isPrivateRequest", () => {
  it("treats API calls as private, same- or cross-origin", () => {
    expect(at("/v1/me")).toBe(true);
    expect(at("https://api.payproof.az/v1/packages/42")).toBe(true);
  });

  it("treats any cross-origin request (e.g. signed file URLs) as private", () => {
    expect(at("https://files.payproof.az/doc.pdf?sig=abc")).toBe(true);
  });

  it("leaves the app shell to the default caches", () => {
    expect(at("/_next/static/chunks/app.js")).toBe(false);
    expect(at("/packages")).toBe(false);
  });
});
