"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { SidebarFilePreview } from "@/types/chat";

type OpenFilePreview = (preview: SidebarFilePreview) => void;

/**
 * Set where file cards can open a preview in the chat side panel. Without a
 * provider (share dialog, Computer sidebar) cards fall back to a modal viewer.
 */
const FilePreviewContext = createContext<OpenFilePreview | undefined>(
  undefined,
);

export const FilePreviewProvider = ({
  children,
  onOpen,
}: {
  children: ReactNode;
  onOpen: OpenFilePreview;
}) => (
  <FilePreviewContext.Provider value={onOpen}>
    {children}
  </FilePreviewContext.Provider>
);

export const useOpenFilePreview = () => useContext(FilePreviewContext);
