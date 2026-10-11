import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SidebarContent, SidebarFilePreview } from "@/types/chat";

const mockCloseSidebar = jest.fn();
let mockSidebarContent: SidebarContent | null = null;

jest.mock("@/hooks/use-workspace-layout", () => ({
  useComputerSidebarOverlay: () => false,
}));

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    const DynamicComponent = () => <div data-testid="dynamic-component" />;
    return DynamicComponent;
  },
}));

jest.mock("@/app/contexts/GlobalState", () => ({
  useGlobalState: () => ({
    sidebarOpen: mockSidebarContent !== null,
    sidebarContent: mockSidebarContent,
    closeSidebar: mockCloseSidebar,
    openSidebar: jest.fn(),
  }),
}));

jest.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const { ComputerSidebar } =
  require("../ComputerSidebar") as typeof import("../ComputerSidebar");
const { FilePreviewSidebar } =
  require("../FilePreviewSidebar") as typeof import("../FilePreviewSidebar");

const markdownPreview: SidebarFilePreview = {
  kind: "file-preview",
  name: "notes.md",
  mediaType: "text/markdown",
  url: "https://files.example/notes.md",
};

describe("FilePreviewSidebar", () => {
  beforeEach(() => {
    mockCloseSidebar.mockReset();
    mockSidebarContent = null;
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: jest.fn(async () => ({
        ok: true,
        status: 200,
        blob: async () =>
          ({
            size: 12,
            type: "text/markdown",
            text: async () => "# Recon plan",
          }) as unknown as Blob,
      })),
    });
  });

  it("shows the file in the side panel slot when the sidebar holds a file preview", async () => {
    mockSidebarContent = markdownPreview;

    render(<ComputerSidebar messages={[]} status="ready" />);

    expect(
      screen.getByRole("region", { name: "Preview of notes.md" }),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("streamdown")).toHaveTextContent(
      "# Recon plan",
    );
    expect(screen.queryByText("HackerAI’s Computer")).not.toBeInTheDocument();
  });

  it("closes from the close button and from Escape inside the panel", async () => {
    render(
      <FilePreviewSidebar
        content={markdownPreview}
        closeSidebar={mockCloseSidebar}
      />,
    );
    await screen.findByTestId("streamdown");

    fireEvent.click(screen.getByRole("button", { name: "Close file preview" }));
    expect(mockCloseSidebar).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole("button", { name: "Download file" }), {
      key: "Escape",
    });
    expect(mockCloseSidebar).toHaveBeenCalledTimes(2);
  });
});
