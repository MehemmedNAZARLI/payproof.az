import { describe, expect, it } from "vitest";

import config from "../../tailwind.config";

// Avatar tones are flat keys: under a nested "avatar.1" Tailwind v4's JS-config bridge emitted
// no CSS for tone 1, so one user in five had an unfilled avatar.
describe("mobile Tailwind theme", () => {
  it.each([1, 2, 3, 4, 5])("has avatar tone %i and its text colour", (n) => {
    expect(config.theme.colors).toHaveProperty([`av-${n}`], `var(--av-${n})`);
    expect(config.theme.colors).toHaveProperty([`av-${n}-text`], `var(--av-${n}t)`);
  });
});
