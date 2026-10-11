import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { FileUrlCacheProvider } from "@/app/contexts/FileUrlCacheContext";
import type { LocalDesktopFile } from "@/types/file";
import { FileContentViewer } from "../FileContentViewer";

describe("FileContentViewer", () => {
  let createObjectURL: jest.Mock;
  let revokeObjectURL: jest.Mock;

  function makeFile(contents: string, name: string, type: string): File {
    const file = new File([contents], name, { type });

    Object.defineProperty(file, "text", {
      configurable: true,
      value: jest.fn(async () => contents),
    });
    Object.defineProperty(file, "slice", {
      configurable: true,
      value: jest.fn(
        (start = 0, end = contents.length, contentType?: string) => ({
          size: end - start,
          type: contentType ?? "",
          text: jest.fn(async () => contents.slice(start, end)),
        }),
      ),
    });

    return file;
  }

  beforeEach(() => {
    createObjectURL = jest.fn(() => "blob:preview-pdf");
    revokeObjectURL = jest.fn();

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
  });

  function renderViewer(
    file: File | LocalDesktopFile,
    props: Partial<ComponentProps<typeof FileContentViewer>> = {},
  ) {
    return render(
      <FileUrlCacheProvider
        getCachedUrl={() => null}
        setCachedUrl={() => undefined}
      >
        <FileContentViewer
          isOpen
          onClose={() => undefined}
          file={file}
          fileName={file.name}
          {...props}
        />
      </FileUrlCacheProvider>,
    );
  }

  /** Minimal Blob stand-in: jsdom's Blob lacks text(). */
  function makeBlob(contents: string, type = ""): Blob {
    return {
      size: contents.length,
      type,
      text: jest.fn(async () => contents),
      slice: jest.fn((start = 0, end = contents.length, contentType?: string) =>
        makeBlob(contents.slice(start, end), contentType ?? ""),
      ),
    } as unknown as Blob;
  }

  function mockFetchResponse(contents: string, type = "") {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => makeBlob(contents, type),
    }));
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
    });
    return fetchMock;
  }

  const remoteFile = (name: string, type: string): LocalDesktopFile => ({
    name,
    type,
    size: 0,
    lastModified: 0,
  });

  it("renders Markdown files with the Markdown renderer", async () => {
    const file = makeFile("# Findings\n\n- XSS", "notes.md", "text/markdown");

    renderViewer(file);

    expect(await screen.findByTestId("streamdown")).toHaveTextContent(
      "# Findings - XSS",
    );
  });

  it("shows an empty state for empty text files", async () => {
    renderViewer(makeFile("", "empty.md", "text/markdown"));

    expect(await screen.findByText("This file is empty.")).toBeInTheDocument();
    expect(screen.queryByTestId("streamdown")).not.toBeInTheDocument();
  });

  it("renders plain text files as preformatted text", async () => {
    const file = makeFile("# not a heading", "scan.txt", "text/plain");

    renderViewer(file);

    expect(await screen.findByText("# not a heading")).toBeInTheDocument();
    expect(screen.queryByTestId("streamdown")).not.toBeInTheDocument();
  });

  it("loads sent chat files through the resolved URL", async () => {
    const fetchMock = mockFetchResponse("## Report body");

    renderViewer(remoteFile("report.md", "text/markdown"), {
      url: "https://files.example/report.md",
    });

    expect(await screen.findByTestId("streamdown")).toHaveTextContent(
      "## Report body",
    );
    expect(fetchMock).toHaveBeenCalledWith("https://files.example/report.md");
  });

  it("renders remote PDFs from a typed blob URL after the signature check", async () => {
    mockFetchResponse("%PDF-1.7\n1 0 obj\n", "application/octet-stream");

    const { container } = renderViewer(
      remoteFile("report.pdf", "application/pdf"),
      { url: "https://files.example/report.pdf" },
    );

    await waitFor(() => {
      expect(container.querySelector("iframe")).toBeInTheDocument();
    });
    expect(container.querySelector("iframe")).toHaveAttribute(
      "src",
      "blob:preview-pdf",
    );
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/pdf");
  });

  it("rejects remote application/pdf files without a PDF signature", async () => {
    mockFetchResponse("<html><script>alert(1)</script></html>", "text/html");

    const { container } = renderViewer(
      remoteFile("report.pdf", "application/pdf"),
      { url: "https://files.example/report.pdf" },
    );

    expect(
      await screen.findByText("Failed to read file content."),
    ).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("downloads remote files through a blob so the original name is kept", async () => {
    const fetchMock = mockFetchResponse("plain");
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    renderViewer(remoteFile("scan.txt", "text/plain"), {
      url: "https://files.example/scan.txt",
    });

    await screen.findByText("plain");
    fetchMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Download file" }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("https://files.example/scan.txt");
    const link = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(link.download).toBe("scan.txt");
    clickSpy.mockRestore();
  });

  it("renders valid in-memory PDFs in the native PDF iframe", async () => {
    const file = makeFile("%PDF-1.7\n1 0 obj\n", "safe.pdf", "application/pdf");

    const { container } = renderViewer(file);

    await waitFor(() => {
      expect(container.querySelector("iframe")).toBeInTheDocument();
    });

    const iframe = container.querySelector("iframe");
    expect((createObjectURL.mock.calls[0][0] as Blob).type).toBe(
      "application/pdf",
    );
    expect(iframe).toHaveAttribute("src", "blob:preview-pdf");
    expect(iframe).not.toHaveAttribute("sandbox");
  });

  it("types untyped in-memory .pdf files as application/pdf before framing them", async () => {
    const file = makeFile("%PDF-1.7\n1 0 obj\n", "upload.pdf", "");

    const { container } = renderViewer(file);

    await waitFor(() => {
      expect(container.querySelector("iframe")).toBeInTheDocument();
    });
    expect(createObjectURL).not.toHaveBeenCalledWith(file);
    expect((createObjectURL.mock.calls[0][0] as Blob).type).toBe(
      "application/pdf",
    );
  });

  it("rejects untyped .pdf files whose content is not a PDF", async () => {
    const file = makeFile(
      "<html><script>alert(1)</script></html>",
      "poc.pdf",
      "",
    );

    const { container } = renderViewer(file);

    expect(
      await screen.findByText("Failed to read file content."),
    ).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("opens agent-shared .pdf files stored as application/octet-stream", async () => {
    mockFetchResponse("%PDF-1.7\n1 0 obj\n", "application/octet-stream");

    const { container } = renderViewer(
      remoteFile("report.pdf", "application/octet-stream"),
      { url: "https://files.example/report.pdf" },
    );

    await waitFor(() => {
      expect(container.querySelector("iframe")).toBeInTheDocument();
    });
    expect((createObjectURL.mock.calls[0][0] as Blob).type).toBe(
      "application/pdf",
    );
  });

  it("shows crafted HTML .pdf files as escaped text instead of iframe PDFs", async () => {
    const file = makeFile(
      "<script>window.__attachmentPreviewPoc = true;</script>",
      "poc.pdf",
      "text/html",
    );

    const { container } = renderViewer(file);

    expect(
      await screen.findByText(
        "<script>window.__attachmentPreviewPoc = true;</script>",
      ),
    ).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("rejects application/pdf browser files without a PDF signature", async () => {
    const file = makeFile(
      "<html><script>alert(1)</script></html>",
      "poc.pdf",
      "application/pdf",
    );

    const { container } = renderViewer(file);

    expect(
      await screen.findByText("Failed to read file content."),
    ).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
  });
});
