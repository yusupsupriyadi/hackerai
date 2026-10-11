import { useMemo } from "react";
import { Download, FileText, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SidebarFilePreview } from "@/types/chat";
import type { LocalDesktopFile } from "@/types/file";
import { FilePreviewBody, useFileDownload } from "./FileContentViewer";

// 44px tap targets on touch layouts, the Computer sidebar's 28px on desktop.
const HEADER_BUTTON_CLASS =
  "size-11 desktop:size-7 relative rounded-md inline-flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface FilePreviewSidebarProps {
  content: SidebarFilePreview;
  closeSidebar: () => void;
}

/** Side panel for reading a chat file next to the conversation. */
export const FilePreviewSidebar = ({
  content,
  closeSidebar,
}: FilePreviewSidebarProps) => {
  const file = useMemo<LocalDesktopFile>(
    () => ({
      name: content.name,
      type: content.mediaType ?? "",
      size: content.sizeBytes ?? 0,
      lastModified: 0,
    }),
    [content.name, content.mediaType, content.sizeBytes],
  );
  const { download, canDownload } = useFileDownload({
    file,
    fileName: content.name,
    fileId: content.fileId,
    url: content.url,
  });

  return (
    // Same frame as the Computer sidebar so both read as one panel slot.
    <section
      id="file-preview-panel"
      aria-label={`Preview of ${content.name}`}
      className="h-full w-full top-0 left-0 desktop:top-auto desktop:left-auto desktop:right-auto z-50 fixed desktop:relative desktop:h-full desktop:mr-4 flex-shrink-0"
      onKeyDown={(e) => {
        if (e.key === "Escape") closeSidebar();
      }}
    >
      <div className="shadow-[0px_0px_8px_0px_rgba(0,0,0,0.02)] border border-border/20 dark:border-border flex h-full w-full bg-background rounded-[22px]">
        <div className="flex-1 min-w-0 p-4 flex flex-col h-full">
          <div className="flex items-center gap-2 w-full">
            <FileText
              className="w-5 h-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div
              className="text-foreground text-lg font-semibold flex-1 min-w-0 truncate"
              title={content.name}
            >
              {content.name}
            </div>
            {canDownload && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={download}
                    className={HEADER_BUTTON_CLASS}
                    aria-label="Download file"
                  >
                    <Download
                      className="w-5 h-5 text-muted-foreground"
                      aria-hidden
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Download</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={closeSidebar}
                  className={HEADER_BUTTON_CLASS}
                  aria-label="Close file preview"
                >
                  <X className="w-5 h-5 text-muted-foreground" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex flex-col rounded-lg overflow-hidden bg-background border border-border/30 dark:border-black/30 flex-1 min-h-0 mt-[16px]">
            <FilePreviewBody
              file={file}
              fileName={content.name}
              fileId={content.fileId}
              url={content.url}
              onDownload={canDownload ? download : undefined}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
