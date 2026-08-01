import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useShortcuts, type ShortcutBinding } from "./use-shortcuts";

function Harness({ bindings, enabled = true }: { bindings: ShortcutBinding[]; enabled?: boolean }) {
  useShortcuts(bindings, enabled);
  return null;
}

describe("useShortcuts", () => {
  it("fires the matching binding on a plain keypress", () => {
    const handler = vi.fn();
    render(<Harness bindings={[{ key: "/", description: "Focus search", handler }]} />);
    fireEvent.keyDown(document, { key: "/" });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("recognizes F-key bindings", () => {
    const handler = vi.fn();
    render(<Harness bindings={[{ key: "F9", description: "Pay", handler }]} />);
    fireEvent.keyDown(document, { key: "F9" });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not fire when a modifier key is held, to avoid shadowing browser shortcuts", () => {
    const handler = vi.fn();
    render(<Harness bindings={[{ key: "/", description: "Focus search", handler }]} />);
    fireEvent.keyDown(document, { key: "/", ctrlKey: true });
    fireEvent.keyDown(document, { key: "/", metaKey: true });
    fireEvent.keyDown(document, { key: "/", altKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("skips a plain-character binding while focus is in a text field", () => {
    const handler = vi.fn();
    document.body.innerHTML = '<input id="target" />';
    const input = document.getElementById("target") as HTMLInputElement;
    render(<Harness bindings={[{ key: "/", description: "Focus search", handler }]} />);
    fireEvent.keyDown(input, { key: "/" });
    expect(handler).not.toHaveBeenCalled();
    document.body.innerHTML = "";
  });

  it("still fires an F-key binding opted into editable fields", () => {
    const handler = vi.fn();
    document.body.innerHTML = '<input id="target" />';
    const input = document.getElementById("target") as HTMLInputElement;
    render(<Harness bindings={[{ key: "F9", description: "Pay", handler, allowInEditableFields: true }]} />);
    fireEvent.keyDown(input, { key: "F9" });
    expect(handler).toHaveBeenCalledOnce();
    document.body.innerHTML = "";
  });

  it("does not fire any binding while a dialog is open", () => {
    const handler = vi.fn();
    document.body.innerHTML = "<dialog open></dialog>";
    render(<Harness bindings={[{ key: "F9", description: "Pay", handler, allowInEditableFields: true }]} />);
    fireEvent.keyDown(document, { key: "F9" });
    expect(handler).not.toHaveBeenCalled();
    document.body.innerHTML = "";
  });

  it("does nothing when disabled", () => {
    const handler = vi.fn();
    render(<Harness enabled={false} bindings={[{ key: "/", description: "Focus search", handler }]} />);
    fireEvent.keyDown(document, { key: "/" });
    expect(handler).not.toHaveBeenCalled();
  });
});
