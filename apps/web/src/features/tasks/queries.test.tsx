import { mockIds } from "@payproof/mocks";
import { waitFor } from "@testing-library/react";
import { expect, test } from "vitest";
import { setToken } from "@/lib/auth";
import { renderHookWithQuery } from "@/test/render";
import { useOpenTaskCount } from "./queries";

test("open task count = every status except RESOLVED (fixtures: 4 open + 2 in progress)", async () => {
  setToken(`mock.${mockIds.user("u1")}`);
  const { result } = renderHookWithQuery(() => useOpenTaskCount());
  await waitFor(() => expect(result.current.data).toBe(6));
});
