// The mock's file links ("signed URLs", @payproof/mocks) point at `<origin>/mock-files/<version id>`
// instead of a file; the viewer draws that version as paper. Kept outside the mock chunk so the app
// can test for it.
import { env } from "@/lib/env";

const MOCK_FILE = /\/mock-files\/([0-9a-f-]+)$/;

/** The document version behind a mock file link, or null for a real URL (or outside mock mode). */
export const mockFileVersion = (url: string) =>
  env.apiMock ? (MOCK_FILE.exec(url)?.[1] ?? null) : null;
