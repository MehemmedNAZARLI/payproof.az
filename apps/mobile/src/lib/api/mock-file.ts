// The mock's file links ("signed URLs") name a document version instead of a file; the
// viewer draws that version as paper. Kept outside the mock chunk so the app can test for it.
export const MOCK_FILE_SCHEME = "mock:paper/";

/** The document version behind a mock file link, or null for a real URL. */
export const mockFileVersion = (url: string) =>
  url.startsWith(MOCK_FILE_SCHEME) ? url.slice(MOCK_FILE_SCHEME.length) : null;
