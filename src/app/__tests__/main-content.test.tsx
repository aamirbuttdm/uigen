import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MainContent } from "@/app/main-content";

vi.mock("@/components/chat/ChatInterface", () => ({
  ChatInterface: () => <div data-testid="chat-interface">Chat</div>,
}));

vi.mock("@/components/editor/FileTree", () => ({
  FileTree: () => <div data-testid="file-tree">FileTree</div>,
}));

vi.mock("@/components/editor/CodeEditor", () => ({
  CodeEditor: () => <div data-testid="code-editor">CodeEditor</div>,
}));

vi.mock("@/components/preview/PreviewFrame", () => ({
  PreviewFrame: () => <div data-testid="preview-frame">PreviewFrame</div>,
}));

vi.mock("@/components/HeaderActions", () => ({
  HeaderActions: () => <div data-testid="header-actions">HeaderActions</div>,
}));

vi.mock("@/lib/contexts/file-system-context", () => ({
  FileSystemProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/lib/contexts/chat-context", () => ({
  ChatProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ResizablePanel: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ResizableHandle: () => <div />,
}));

describe("MainContent tab toggle", () => {
  afterEach(() => {
    cleanup();
  });

  test("initially shows the preview view", async () => {
    render(<MainContent />);

    // Wait for mount (bypasses SSR guard)
    const previewTab = await screen.findByRole("tab", { name: "Preview" });
    expect(previewTab).toBeDefined();
    expect(screen.getByTestId("preview-frame")).toBeDefined();
    expect(screen.queryByTestId("code-editor")).toBeNull();
  });

  test("switches to code view when Code tab is clicked", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    const codeTab = await screen.findByRole("tab", { name: "Code" });
    await user.click(codeTab);

    expect(screen.queryByTestId("preview-frame")).toBeNull();
    expect(screen.getByTestId("code-editor")).toBeDefined();
  });

  test("switches back to preview view when Preview tab is clicked", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    // Switch to Code
    const codeTab = await screen.findByRole("tab", { name: "Code" });
    await user.click(codeTab);
    expect(screen.getByTestId("code-editor")).toBeDefined();

    // Switch back to Preview
    const previewTab = screen.getByRole("tab", { name: "Preview" });
    await user.click(previewTab);

    expect(screen.getByTestId("preview-frame")).toBeDefined();
    expect(screen.queryByTestId("code-editor")).toBeNull();
  });

  test("Preview tab is active by default", async () => {
    render(<MainContent />);

    const previewTab = await screen.findByRole("tab", { name: "Preview" });
    expect(previewTab.getAttribute("data-state")).toBe("active");

    const codeTab = screen.getByRole("tab", { name: "Code" });
    expect(codeTab.getAttribute("data-state")).toBe("inactive");
  });

  test("Code tab becomes active after clicking it", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    const codeTab = await screen.findByRole("tab", { name: "Code" });
    await user.click(codeTab);

    expect(codeTab.getAttribute("data-state")).toBe("active");

    const previewTab = screen.getByRole("tab", { name: "Preview" });
    expect(previewTab.getAttribute("data-state")).toBe("inactive");
  });
});
