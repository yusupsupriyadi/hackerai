import { toast } from "sonner";
import { isTauriEnvironment, openDownloadsFolder } from "../hooks/useTauri";

/**
 * Saves a stored file under its original name. Fetching to a blob keeps the
 * name for cross-origin signed URLs; if that fails the URL opens in a new tab.
 */
export async function downloadFileFromUrl(
  url: string,
  fileName: string,
): Promise<void> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(blobUrl);

    if (isTauriEnvironment()) {
      toast.success(`Downloaded ${fileName}`, {
        description: "Saved to Downloads folder",
        action: {
          label: "Show in folder",
          onClick: () => openDownloadsFolder(),
        },
      });
    }
  } catch (error) {
    console.error("Error downloading file:", error);
    toast.error("Failed to download file");
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
