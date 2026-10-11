import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useAction } from "convex/react";
import type { ComponentProps } from "react";
import { FileUrlCacheProvider } from "@/app/contexts/FileUrlCacheContext";
import { FilePreviewProvider } from "@/app/contexts/FilePreviewContext";
import { FilePartRenderer } from "../FilePartRenderer";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, src, ...props }: any) => {
    const React = require("react");
    return React.createElement("img", { alt, src, ...props });
  },
}));

describe("FilePartRenderer", () => {
  let mockGetFileUrlAction: jest.Mock;
  let cache: Map<string, string>;

  beforeEach(() => {
    mockGetFileUrlAction = useAction({} as any) as unknown as jest.Mock;
    mockGetFileUrlAction.mockReset();
    cache = new Map();
  });

  function renderWithCache(
    part: ComponentProps<typeof FilePartRenderer>["part"],
  ) {
    return render(
      <FileUrlCacheProvider
        getCachedUrl={(fileId) => cache.get(fileId) ?? null}
        setCachedUrl={(fileId, url) => cache.set(fileId, url)}
      >
        <FilePartRenderer
          part={part}
          partIndex={0}
          messageId="message-1"
          totalFileParts={1}
        />
      </FileUrlCacheProvider>,
    );
  }

  it("shows a loading image tile instead of a transient unavailable error while fetching a file URL", async () => {
    let resolveUrl: (url: string) => void = () => {};
    mockGetFileUrlAction.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveUrl = resolve;
      }),
    );

    renderWithCache({
      fileId: "file-1" as any,
      name: "screenshot.png",
      mediaType: "image/png",
      s3Key: "uploads/screenshot.png",
    });

    expect(
      screen.queryByText("Image URL not available"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading screenshot.png" }),
    ).toBeInTheDocument();

    await act(async () => {
      resolveUrl("https://files.example/screenshot.png");
    });

    expect(await screen.findByAltText("screenshot.png")).toHaveAttribute(
      "src",
      "https://files.example/screenshot.png",
    );
    expect(cache.get("file-1")).toBe("https://files.example/screenshot.png");
  });

  describe("document cards", () => {
    let fetchMock: jest.Mock;

    beforeEach(() => {
      fetchMock = jest.fn(async () => ({
        ok: true,
        status: 200,
        blob: async () =>
          ({
            size: 9,
            type: "text/markdown",
            text: async () => "# Summary",
          }) as unknown as Blob,
      }));
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        value: fetchMock,
      });
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: jest.fn(() => "blob:download"),
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: jest.fn(),
      });
    });

    it("opens previewable files in the chat side panel when one is available", () => {
      const onOpen = jest.fn();

      render(
        <FilePreviewProvider onOpen={onOpen}>
          <FilePartRenderer
            part={{
              fileId: "file-pdf" as any,
              name: "report.pdf",
              mediaType: "application/pdf",
              sizeBytes: 2048,
              url: "https://files.example/stale.pdf",
            }}
            partIndex={0}
            messageId="message-1"
          />
        </FilePreviewProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Open report.pdf" }));

      expect(onOpen).toHaveBeenCalledWith({
        kind: "file-preview",
        name: "report.pdf",
        mediaType: "application/pdf",
        fileId: "file-pdf",
        url: undefined,
        sizeBytes: 2048,
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("opens agent-shared PDFs stored as application/octet-stream, like Markdown", () => {
      const onOpen = jest.fn();

      render(
        <FilePreviewProvider onOpen={onOpen}>
          <FilePartRenderer
            part={{
              fileId: "file-agent-pdf" as any,
              name: "scan-report.pdf",
              mediaType: "application/octet-stream",
            }}
            partIndex={0}
            messageId="message-1"
          />
        </FilePreviewProvider>,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Open scan-report.pdf" }),
      );

      expect(onOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "file-preview",
          name: "scan-report.pdf",
          fileId: "file-agent-pdf",
        }),
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("opens Markdown files in the preview dialog outside the chat timeline", async () => {
      mockGetFileUrlAction.mockResolvedValue("https://files.example/notes.md");

      renderWithCache({
        fileId: "file-md" as any,
        name: "notes.md",
        mediaType: "text/markdown",
      });

      fireEvent.click(screen.getByRole("button", { name: "Open notes.md" }));

      expect(
        await screen.findByRole("dialog", { name: "Preview of notes.md" }),
      ).toBeInTheDocument();
      expect(await screen.findByTestId("streamdown")).toHaveTextContent(
        "# Summary",
      );
      expect(mockGetFileUrlAction).toHaveBeenCalledWith({ fileId: "file-md" });
      expect(fetchMock).toHaveBeenCalledWith("https://files.example/notes.md");
    });

    it("closes the preview with Escape", async () => {
      mockGetFileUrlAction.mockResolvedValue("https://files.example/notes.md");

      renderWithCache({
        fileId: "file-md" as any,
        name: "notes.md",
        mediaType: "text/markdown",
      });

      fireEvent.click(screen.getByRole("button", { name: "Open notes.md" }));
      await screen.findByRole("dialog", { name: "Preview of notes.md" });

      fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("still downloads files the viewer cannot show", async () => {
      mockGetFileUrlAction.mockResolvedValue("https://files.example/loot.zip");

      renderWithCache({
        fileId: "file-zip" as any,
        name: "loot.zip",
        mediaType: "application/zip",
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Download loot.zip" }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "https://files.example/loot.zip",
        );
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
