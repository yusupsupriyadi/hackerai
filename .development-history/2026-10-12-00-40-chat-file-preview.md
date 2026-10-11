# Open PDF and Markdown files from chat in the side panel

## Summary

File cards in the chat timeline open previewable files (PDF, Markdown, other
text) in the right side panel, the slot the Computer sidebar uses. Markdown
renders with the message renderer. Where there is no panel (share dialog, file
list inside the Computer sidebar) the card opens the modal viewer instead.

## Changes

- `types/chat.ts`: `SidebarFilePreview` (`kind: "file-preview"`) in `SidebarContent`, `isSidebarFilePreview`.
- `app/contexts/FilePreviewContext.tsx`: lets chat file cards open the panel; provided around `Messages` in `chat.tsx`.
- `app/components/FilePreviewSidebar.tsx`: panel with the Computer sidebar frame, download and close; routed from the `ComputerSidebar` wrapper.
- `app/components/FileContentViewer.tsx`: split into `FilePreviewBody` and `useFileDownload`, shared by modal and panel; remote PDFs need the `%PDF-` signature and render from a typed blob URL; empty-file state.
- `app/components/file-download.ts`: blob download helper moved out of `FilePartRenderer`.
- `lib/utils/file-utils.ts`: `isMarkdownFile`, `canPreviewFile`; `isPdfFile` also accepts `.pdf` when the media type is generic (agent-shared files are stored as `application/octet-stream`). `lib/utils/sidebar-utils.ts`: regeneration keeps a file preview open.
- `chat.tsx`: overlay dialog label names the previewed file.

## Decisions

- Reused the sidebar slot so desktop split, narrow-screen overlay, focus trap, and close-on-chat-switch come for free.
- `toolCallId?: never` on the preview type keeps existing `toolCallId` reads valid without a fake id.
- Remote PDFs are fetched (bucket CORS GET, already required for downloads) instead of loading the signed URL into the iframe.
- Every PDF blob, in-memory ones included, is re-typed `application/pdf` after the `%PDF-` check, so the `.pdf` extension fallback cannot reopen the HTML-in-iframe issue fixed in #852. A `.pdf` that declares another type (e.g. `text/html`) still shows as text.

## Verification

- jest: 12 suites / 146 tests (viewer, renderer, panel, file-utils, sidebar-utils, upload preview, ComputerSidebar, MessageItem, ShareDialog, MemoizedMarkdown) and 8 suites / 123 tests (chat integration, Messages, sidebar hooks, SubagentsSidebar): pass.
- After the PDF detection change: 8 suites / 105 tests (viewer, renderer, panel, file-utils, sidebar-utils, upload preview): pass.
- `tsc --noEmit`, eslint, prettier on touched files: pass.

## Limitations

- Not exercised in a running browser; PDF iframe rendering and R2 CORS are unverified.
- Composer attachments and the "View all files" dialog keep their modal and download behavior.

## Follow-up

- Manual check: open a sent PDF and `.md` in chat on desktop and narrow width, download from the panel, switch chats.
