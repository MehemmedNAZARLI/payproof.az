import { mockIds } from "@payproof/mocks";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { setToken } from "@/lib/auth";
import { renderWithQuery } from "@/test/render";
import { bboxStyle, ImageSource, SourceFile } from "./source-file";

// react-pdf needs canvas and a worker; jsdom has neither — stand in for the page renderer
vi.mock("./pdf-page", () => ({
  default: ({ url, page }: { url: string; page: number }) => (
    <div data-testid="pdf">{`${url}#${page}`}</div>
  ),
}));

beforeEach(() => setToken(`mock.${mockIds.user("u1")}`));

test("normalised bbox → percentage box on the page", () => {
  expect(bboxStyle([0.1, 0.25, 0.5, 0.05])).toEqual({
    left: "10%",
    top: "25%",
    width: "50%",
    height: "5%",
  });
});

test("a PDF version: fetches the signed link, then renders that page", async () => {
  renderWithQuery(
    <SourceFile
      versionId={mockIds.version("pkg_1044", "invoice", 1)}
      fileName="INV-1044.pdf"
      page={1}
      bbox={null}
    />,
  );
  expect(await screen.findByTestId("pdf")).toHaveTextContent(/mock-files.*#1$/);
});

test("the highlight is positioned against the page itself, not the scrolling box around it", async () => {
  renderWithQuery(
    <SourceFile
      versionId={mockIds.version("pkg_1044", "invoice", 1)}
      fileName="INV-1044.pdf"
      page={1}
      bbox={[0.1, 0.1, 0.2, 0.05]}
    />,
  );
  const pdf = await screen.findByTestId("pdf");
  const box = screen.getByTestId("bbox").parentElement!;
  expect(box).toBe(pdf.parentElement); // same page box: percentages follow the page
  expect(box).toHaveClass("relative");
  expect(box).not.toHaveClass("overflow-auto");
});

test("an image scan is shown as an image, with the highlight box over it", async () => {
  render(
    <ImageSource url="https://x/scan.png" fileName="TS-5531.png" bbox={[0.2, 0.4, 0.3, 0.1]} />,
  );
  expect(screen.getByRole("img", { name: "TS-5531.png" })).toHaveAttribute(
    "src",
    "https://x/scan.png",
  );
  expect(screen.getByTestId("bbox")).toHaveStyle({ left: "20%", top: "40%" });
});

test("anything but a PDF is shown as an image (scans: png, jpg, webp …)", async () => {
  renderWithQuery(
    <SourceFile
      versionId={mockIds.version("pkg_1047", "invoice", 1)}
      fileName="INV-1047_scan.webp"
      page={1}
      bbox={null}
    />,
  );
  expect(await screen.findByRole("img", { name: "INV-1047_scan.webp" })).toBeInTheDocument();
});
