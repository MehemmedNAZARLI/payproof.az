import { onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/ui/toast-store";

import { refreshAll } from "./refresh";

describe("refreshAll", () => {
  afterEach(() => {
    onlineManager.setOnline(true);
    vi.restoreAllMocks();
  });

  it("refetches every query and waits for all of them, failures included", async () => {
    const a = { refetch: vi.fn().mockResolvedValue({}) };
    const b = { refetch: vi.fn().mockRejectedValue(new Error("x")) };
    await expect(refreshAll([a, b])).resolves.toBeUndefined();
    expect(a.refetch).toHaveBeenCalledOnce();
    expect(b.refetch).toHaveBeenCalledOnce();
  });

  it("offline, keeps what is shown and says why instead of waiting forever", async () => {
    onlineManager.setOnline(false);
    const show = vi.spyOn(toast, "error");
    const a = { refetch: vi.fn() };
    await refreshAll([a]);
    expect(a.refetch).not.toHaveBeenCalled();
    expect(show).toHaveBeenCalledOnce();
  });
});
