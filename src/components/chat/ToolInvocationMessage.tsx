"use client";

import { Loader2 } from "lucide-react";

interface ToolInvocation {
  toolName: string;
  args?: Record<string, any>;
  state?: string;
  result?: unknown;
}

interface ToolInvocationMessageProps {
  toolInvocation: ToolInvocation;
}

function basename(path?: string): string | undefined {
  if (!path) return undefined;
  return path.split("/").filter(Boolean).pop();
}

export function getToolInvocationLabel(
  toolName: string,
  args?: Record<string, any>
): string {
  const command = args?.command as string | undefined;
  const name = basename(args?.path);

  const withFile = (verb: string) => (name ? `${verb} ${name}` : `${verb} file`);

  if (toolName === "str_replace_editor") {
    switch (command) {
      case "create":
        return withFile("Creating");
      case "str_replace":
      case "insert":
        return withFile("Editing");
      case "view":
        return withFile("Viewing");
      case "undo_edit":
        return withFile("Reverting");
    }
  }

  if (toolName === "file_manager") {
    switch (command) {
      case "rename": {
        const newName = basename(args?.new_path);
        if (name && newName) return `Renaming ${name} → ${newName}`;
        return withFile("Renaming");
      }
      case "delete":
        return withFile("Deleting");
    }
  }

  return toolName;
}

export function ToolInvocationMessage({
  toolInvocation,
}: ToolInvocationMessageProps) {
  const isComplete =
    toolInvocation.state === "result" && toolInvocation.result != null;
  const label = getToolInvocationLabel(
    toolInvocation.toolName,
    toolInvocation.args
  );

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs border border-neutral-200">
      {isComplete ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
