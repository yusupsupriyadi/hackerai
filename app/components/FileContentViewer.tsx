import { Download, FileText, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  canPreviewFile,
  isMarkdownFile,
  isPdfFile,
} from "@/lib/utils/file-utils";
import { LocalDesktopFile } from "@/types/file";
import { useFileUrlCacheContext } from "../contexts/FileUrlCacheContext";
import { MemoizedMarkdown } from "./MemoizedMarkdown";
import { downloadFileFromUrl } from "./file-download";

const isBrowserFile = (file: File | LocalDesktopFile): file is File =>
  typeof globalThis.File !== "undefined" && file instanceof globalThis.File;

/** Guard against freezing the UI on very large text files */
const MAX_PREVIEW_CHARS = 500_000;
const PDF_MAGIC_BYTES = "%PDF-";

async function hasPdfMagicBytes(file: Blob): Promise<boolean> {
  const header = await file.slice(0, PDF_MAGIC_BYTES.length).text();
  return header === PDF_MAGIC_BYTES;
}

interface FileSourceProps {
  file: File | LocalDesktopFile;
  fileName: string;
  /**
   * S3 file id for files whose content is not in memory: draft attachments
   * restored after reload and files already sent in a chat.
   */
  fileId?: string;
  /** Already-resolved URL, used when there is no file id to resolve. */
  url?: string;
}

function useResolveFileUrl() {
  const getFileUrlAction = useAction(api.s3Actions.getFileUrlAction);
  const fileUrlCache = useFileUrlCacheContext();

  return useCallback(
    async (id: string): Promise<string | null> => {
      const cachedUrl = fileUrlCache?.getCachedUrl(id);
      if (cachedUrl) return cachedUrl;

      const url = await getFileUrlAction({ fileId: id as Id<"files"> });
      if (url) fileUrlCache?.setCachedUrl(id, url);
      return url;
    },
    [fileUrlCache, getFileUrlAction],
  );
}

export function useFileDownload({
  file,
  fileName,
  fileId,
  url,
}: FileSourceProps) {
  const resolveFileUrl = useResolveFileUrl();

  const download = useCallback(async () => {
    if (isBrowserFile(file)) {
      const blobUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      return;
    }

    const downloadUrl = fileId ? await resolveFileUrl(fileId) : url;
    if (downloadUrl) await downloadFileFromUrl(downloadUrl, fileName);
  }, [file, fileName, fileId, url, resolveFileUrl]);

  return { download, canDownload: isBrowserFile(file) || !!fileId || !!url };
}

interface FilePreviewBodyProps extends FileSourceProps {
  /** Offered as a fallback when the preview cannot be shown. */
  onDownload?: () => void;
}

/** Loads a file and shows it as a PDF, rendered Markdown, or plain text. */
export const FilePreviewBody = ({
  file,
  fileName,
  fileId,
  url,
  onDownload,
}: FilePreviewBodyProps) => {
  const resolveFileUrl = useResolveFileUrl();
  const [content, setContent] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    // Blob URL created for PDF previews; must be revoked on cleanup.
    let createdBlobUrl: string | null = null;

    const loadContent = async () => {
      setIsLoading(true);
      setError(null);
      setTruncated(false);
      setPdfUrl(null);
      setContent("");

      // Previewability is based on name/media type, so it works for both real
      // browser Files and metadata-only descriptors (restored drafts and files
      // already sent in a chat). Without an in-memory File or a way to fetch
      // the content there is nothing to read.
      if (!canPreviewFile(file) || (!isBrowserFile(file) && !fileId && !url)) {
        if (!cancelled) {
          setError("Preview isn't available for this file type.");
          setIsLoading(false);
        }
        return;
      }

      try {
        let source: Blob;
        if (isBrowserFile(file)) {
          source = file;
        } else {
          // Fetch from storage through a short-lived signed URL keyed by the
          // file id, or through the URL the caller already resolved.
          const remoteUrl = fileId ? await resolveFileUrl(fileId) : url;
          if (!remoteUrl) throw new Error("Could not resolve file URL");

          const response = await fetch(remoteUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch file (${response.status})`);
          }
          source = await response.blob();
        }

        if (isPdfFile(file)) {
          // Render via the browser's native PDF viewer from a blob URL. The
          // signature check keeps other content out of the iframe, and the
          // blob is always typed application/pdf so the browser never treats
          // it as HTML, whatever type the file or storage declared.
          if (!(await hasPdfMagicBytes(source))) {
            throw new Error("Invalid PDF signature");
          }
          if (cancelled) return;

          createdBlobUrl = URL.createObjectURL(
            source.slice(0, source.size, "application/pdf"),
          );
          setPdfUrl(createdBlobUrl);
          return;
        }

        const text = await source.text();
        if (cancelled) return;

        if (text.length > MAX_PREVIEW_CHARS) {
          setContent(text.slice(0, MAX_PREVIEW_CHARS));
          setTruncated(true);
        } else {
          setContent(text);
        }
      } catch {
        if (!cancelled) setError("Failed to read file content.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadContent();

    return () => {
      cancelled = true;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [file, fileId, url, resolveFileUrl]);

  const truncatedNotice = truncated && (
    <p className="mt-4 text-xs italic text-muted-foreground">
      Preview truncated. Download the file to view its full contents.
    </p>
  );

  return (
    <div className="relative flex min-h-0 w-full flex-1">
      {isLoading ? (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
          <FileText
            className="size-10 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">{error}</p>
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <Download className="size-4" aria-hidden="true" />
              Download
            </button>
          )}
        </div>
      ) : pdfUrl ? (
        // Chromium's PDF viewer can fail inside sandboxed iframes. The PDF
        // path is gated above by magic bytes and an application/pdf blob type.
        <iframe
          src={pdfUrl}
          title={`Preview of ${fileName}`}
          className="h-full w-full border-0"
        />
      ) : !content ? (
        <div className="flex h-full w-full items-center justify-center px-6 text-center">
          <p className="text-sm text-muted-foreground">This file is empty.</p>
        </div>
      ) : isMarkdownFile(file) ? (
        // Same renderer and prose styles as assistant messages, at the
        // chat column's reading width.
        <div className="w-full overflow-auto">
          <div className="prose mx-auto w-full min-w-0 max-w-3xl space-y-3 px-4 py-6 text-foreground dark:prose-invert md:px-8">
            <MemoizedMarkdown content={content} />
            {truncatedNotice}
          </div>
        </div>
      ) : (
        <div
          className="w-full overflow-auto px-4 py-[15px] font-mono text-xs leading-[18px] text-foreground"
          style={{
            overflowWrap: "break-word",
            wordBreak: "normal",
            whiteSpace: "pre-wrap",
          }}
        >
          <pre className="max-w-full whitespace-pre-wrap">{content}</pre>
          {truncatedNotice}
        </div>
      )}
    </div>
  );
};

interface FileContentViewerProps extends FileSourceProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FileContentViewer = ({
  isOpen,
  onClose,
  file,
  fileName,
  fileId,
  url,
}: FileContentViewerProps) => {
  const { download, canDownload } = useFileDownload({
    file,
    fileName,
    fileId,
    url,
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview of ${fileName}`}
        className="pointer-events-auto flex h-[calc(100vh-32px)] w-[calc(100vw-32px)] max-w-[1200px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0px_0px_8px_0px_rgba(0,0,0,0.02)] md:h-[calc(100vh-80px)] md:w-[calc(100vw-80px)]"
      >
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-muted-foreground">
            <div className="flex size-9 shrink-0 items-center justify-center">
              <FileText className="size-5" aria-hidden="true" />
            </div>
            <span
              className="truncate text-sm font-medium leading-5 text-foreground"
              title={fileName}
            >
              {fileName}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {canDownload && (
              <button
                type="button"
                onClick={download}
                aria-label="Download file"
                className="flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-accent"
              >
                <Download
                  className="size-[18px] text-muted-foreground"
                  aria-hidden="true"
                />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              // Moves keyboard focus into the dialog when it opens.
              autoFocus
              aria-label="Close file preview"
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-accent"
            >
              <X
                className="size-[18px] text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </div>
        </header>

        <FilePreviewBody
          file={file}
          fileName={fileName}
          fileId={fileId}
          url={url}
          onDownload={canDownload ? download : undefined}
        />
      </div>
    </div>
  );
};
