import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  ToolInvocationMessage,
  getToolInvocationLabel,
} from "../ToolInvocationMessage";

afterEach(() => {
  cleanup();
});

// --- getToolInvocationLabel ---

test("getToolInvocationLabel: str_replace_editor create", () => {
  expect(
    getToolInvocationLabel("str_replace_editor", {
      command: "create",
      path: "/App.jsx",
    })
  ).toBe("Creating App.jsx");
});

test("getToolInvocationLabel: str_replace and insert both read as editing", () => {
  expect(
    getToolInvocationLabel("str_replace_editor", {
      command: "str_replace",
      path: "/src/components/Card.jsx",
    })
  ).toBe("Editing Card.jsx");
  expect(
    getToolInvocationLabel("str_replace_editor", {
      command: "insert",
      path: "/src/components/Card.jsx",
    })
  ).toBe("Editing Card.jsx");
});

test("getToolInvocationLabel: view and undo_edit", () => {
  expect(
    getToolInvocationLabel("str_replace_editor", {
      command: "view",
      path: "/App.jsx",
    })
  ).toBe("Viewing App.jsx");
  expect(
    getToolInvocationLabel("str_replace_editor", {
      command: "undo_edit",
      path: "/App.jsx",
    })
  ).toBe("Reverting App.jsx");
});

test("getToolInvocationLabel: extracts basename from nested path", () => {
  expect(
    getToolInvocationLabel("str_replace_editor", {
      command: "create",
      path: "/src/components/ui/Button.tsx",
    })
  ).toBe("Creating Button.tsx");
});

test("getToolInvocationLabel: file_manager rename shows both names", () => {
  expect(
    getToolInvocationLabel("file_manager", {
      command: "rename",
      path: "/Old.jsx",
      new_path: "/components/New.jsx",
    })
  ).toBe("Renaming Old.jsx → New.jsx");
});

test("getToolInvocationLabel: file_manager delete", () => {
  expect(
    getToolInvocationLabel("file_manager", {
      command: "delete",
      path: "/src/utils.js",
    })
  ).toBe("Deleting utils.js");
});

test("getToolInvocationLabel: missing path falls back to verb + file", () => {
  expect(
    getToolInvocationLabel("str_replace_editor", { command: "create" })
  ).toBe("Creating file");
  expect(getToolInvocationLabel("file_manager", { command: "delete" })).toBe(
    "Deleting file"
  );
});

test("getToolInvocationLabel: unknown tool or no command falls back to tool name", () => {
  expect(getToolInvocationLabel("str_replace_editor", {})).toBe(
    "str_replace_editor"
  );
  expect(getToolInvocationLabel("some_other_tool", { command: "create" })).toBe(
    "some_other_tool"
  );
});

// --- ToolInvocationMessage component ---

test("ToolInvocationMessage shows green dot and label when complete", () => {
  const { container } = render(
    <ToolInvocationMessage
      toolInvocation={{
        toolName: "str_replace_editor",
        args: { command: "create", path: "/App.jsx" },
        state: "result",
        result: "Success",
      }}
    />
  );

  expect(screen.getByText("Creating App.jsx")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).not.toBeNull();
  expect(container.querySelector(".animate-spin")).toBeNull();
});

test("ToolInvocationMessage shows spinner while in progress", () => {
  const { container } = render(
    <ToolInvocationMessage
      toolInvocation={{
        toolName: "str_replace_editor",
        args: { command: "str_replace", path: "/App.jsx" },
        state: "call",
      }}
    />
  );

  expect(screen.getByText("Editing App.jsx")).toBeDefined();
  expect(container.querySelector(".animate-spin")).not.toBeNull();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("ToolInvocationMessage renders rename label with both file names", () => {
  render(
    <ToolInvocationMessage
      toolInvocation={{
        toolName: "file_manager",
        args: { command: "rename", path: "/Old.jsx", new_path: "/New.jsx" },
        state: "result",
        result: { success: true },
      }}
    />
  );

  expect(screen.getByText("Renaming Old.jsx → New.jsx")).toBeDefined();
});
