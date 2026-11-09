let started: Promise<void> | undefined;

/** Starts the MSW worker once (StrictMode runs effects twice). Browser only — see app/mock-gate. */
export function startMocking(): Promise<void> {
  started ??= import("@payproof/mocks/browser")
    .then(({ createMockWorker }) => createMockWorker().start())
    .then(
      () => undefined,
      (error: unknown) => {
        started = undefined; // let the next attempt try again
        throw error;
      },
    );
  return started;
}
