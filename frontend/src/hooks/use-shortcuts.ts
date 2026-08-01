"use client";

import { useEffect, useRef } from "react";

export interface ShortcutBinding {
  /** A single character (e.g. "/", "+", "?") or an F-key name ("F7"-"F12"). */
  key: string;
  handler: (event: KeyboardEvent) => void;
  description: string;
  /**
   * Allow the shortcut to fire even while focus is inside a text input,
   * textarea, select, or contenteditable element. Only safe for keys with
   * no normal meaning while typing (F-keys) — never for printable
   * characters like "/", "+", "-", or "?".
   */
  allowInEditableFields?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function hasOpenDialog(): boolean {
  return document.querySelector("dialog[open]") !== null;
}

function matchesBinding(event: KeyboardEvent, key: string): boolean {
  if (/^F\d{1,2}$/.test(key)) return event.key === key;
  if (key === "?") return event.key === "?";
  return event.key === key;
}

/**
 * Registers page-scoped keyboard shortcuts. Shortcuts never fire with a
 * modifier held (so they can't shadow browser/OS shortcuts like Ctrl+W or
 * Cmd+N), never fire while a native <dialog> is open (the dialog owns its
 * own keyboard interaction, including Escape-to-close), and are skipped
 * while focus is in a text field unless explicitly opted in.
 */
export function useShortcuts(bindings: ShortcutBinding[], enabled = true) {
  const bindingsRef = useRef(bindings);
  useEffect(() => {
    bindingsRef.current = bindings;
  });

  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (hasOpenDialog()) return;
      const editable = isEditableTarget(event.target);
      for (const binding of bindingsRef.current) {
        if (!matchesBinding(event, binding.key)) continue;
        if (editable && !binding.allowInEditableFields) continue;
        event.preventDefault();
        binding.handler(event);
        return;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
