import { describe, expect, it } from "vitest";

import { notificationText } from "./english";

describe("English notification copy", () => {
  it("preserves a person's name while translating approval copy", () => {
    expect(
      notificationText(
        "INV-1038 Rəşad Əliyev tərəfindən təsdiqləndi — paket göndərilməyə hazırdır.",
      ),
    ).toBe("INV-1038 Rəşad Əliyev approved the package. It is ready to send.");
  });
  it("does not leak a partly translated invalidation reason", () => {
    expect(
      notificationText(
        "INV-1036: Sənəd dəyişdi. v2 təsdiqi etibarsızlaşdı — v3 yenidən təsdiq tələb edir.",
      ),
    ).toBe("Package activity updated. Open the package to review its current status.");
  });
  it("keeps English server notifications intact", () => {
    expect(notificationText("INV-1038 is ready for review.")).toBe("INV-1038 is ready for review.");
  });
});
