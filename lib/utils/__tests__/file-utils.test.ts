import {
  canPreviewFile,
  isMarkdownFile,
  isPdfFile,
  isTextViewableFile,
} from "../file-utils";

const descriptor = (name: string, type: string) => ({
  name,
  type,
  size: 0,
  lastModified: 0,
});

describe("file-utils preview classification", () => {
  it("treats application/pdf files as PDFs", () => {
    const file = new File(["%PDF-1.7"], "report.pdf", {
      type: "application/pdf",
    });

    expect(isPdfFile(file)).toBe(true);
  });

  it("does not classify .pdf filenames as PDFs when another media type is declared", () => {
    const htmlFile = new File(["<script>alert(1)</script>"], "report.pdf", {
      type: "text/html",
    });
    const textFile = new File(["notes"], "report.pdf", { type: "text/plain" });

    expect(isPdfFile(htmlFile)).toBe(false);
    expect(isPdfFile(textFile)).toBe(false);
    expect(isTextViewableFile(htmlFile)).toBe(true);
  });

  it("trusts the .pdf extension only for generic media types", () => {
    expect(isPdfFile(new File(["%PDF-1.7"], "report.pdf"))).toBe(true);
    expect(
      isPdfFile(descriptor("REPORT.PDF", "application/octet-stream")),
    ).toBe(true);
    expect(
      isPdfFile(descriptor("report.bin", "application/octet-stream")),
    ).toBe(false);
  });
});

describe("isMarkdownFile", () => {
  it("matches Markdown media types and extensions", () => {
    expect(isMarkdownFile(descriptor("notes.txt", "text/markdown"))).toBe(true);
    expect(
      isMarkdownFile(descriptor("notes", "text/x-markdown; charset=utf-8")),
    ).toBe(true);
    expect(isMarkdownFile(descriptor("REPORT.MD", ""))).toBe(true);
    expect(isMarkdownFile(descriptor("report.markdown", "text/plain"))).toBe(
      true,
    );
  });

  it("does not treat other text files as Markdown", () => {
    expect(isMarkdownFile(descriptor("notes.txt", "text/plain"))).toBe(false);
    expect(isMarkdownFile(descriptor("data.json", "application/json"))).toBe(
      false,
    );
  });
});

describe("canPreviewFile", () => {
  it("allows PDFs and text-viewable files", () => {
    expect(canPreviewFile(descriptor("report.pdf", "application/pdf"))).toBe(
      true,
    );
    expect(canPreviewFile(descriptor("findings.md", ""))).toBe(true);
    expect(canPreviewFile(descriptor("scan.log", "text/plain"))).toBe(true);
  });

  it("rejects binary formats the viewer cannot show", () => {
    expect(canPreviewFile(descriptor("loot.zip", "application/zip"))).toBe(
      false,
    );
    expect(
      canPreviewFile(
        descriptor(
          "report.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
      ),
    ).toBe(false);
  });
});
