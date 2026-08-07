import { fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { TRANSLATION_UNAVAILABLE_REASON } from "@/lib/translation";
import type { ShopLanguage } from "@/types/shop";

import { SecondaryNameField } from "./secondary-name-field";

/** Renders the field inside a real form, since it is register-driven. */
function Harness({
  secondaryLanguage,
  error,
}: {
  secondaryLanguage: ShopLanguage | "";
  error?: string;
}) {
  const { register } = useForm<{ secondary_name: string }>({
    defaultValues: { secondary_name: "" },
  });
  return (
    <SecondaryNameField
      id="secondary-name"
      registration={register("secondary_name")}
      secondaryLanguage={secondaryLanguage}
      error={error}
    />
  );
}

describe("SecondaryNameField", () => {
  it("stays hidden when the shop has not chosen a second language", () => {
    const { container } = render(<Harness secondaryLanguage="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("labels the field with the shop's chosen language", () => {
    render(<Harness secondaryLanguage="MALAYALAM" />);
    expect(screen.getByLabelText("Name in Malayalam (optional)")).toBeInTheDocument();
  });

  it("accepts typed second-language text", () => {
    render(<Harness secondaryLanguage="ARABIC" />);
    const input = screen.getByLabelText(/Name in Arabic/);
    fireEvent.change(input, { target: { value: "\u0623\u0631\u0632" } });
    expect(input).toHaveValue("\u0623\u0631\u0632");
  });

  it("shows the translate button disabled with a visible reason, never inert-but-clickable", () => {
    render(<Harness secondaryLanguage="ARABIC" />);
    const translate = screen.getByRole("button", { name: /Translate/ });
    expect(translate).toBeDisabled();
    expect(translate).toHaveAttribute("title", TRANSLATION_UNAVAILABLE_REASON);
    // The reason is on screen, not only in a tooltip.
    expect(screen.getByText(TRANSLATION_UNAVAILABLE_REASON)).toBeInTheDocument();
  });

  it("marks the input's language so assistive tech announces it correctly", () => {
    render(<Harness secondaryLanguage="URDU" />);
    expect(screen.getByLabelText(/Name in Urdu/)).toHaveAttribute("lang", "urdu");
  });

  it("surfaces a field error", () => {
    render(<Harness secondaryLanguage="ARABIC" error="Too long." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Too long.");
  });

  describe("RTL scope", () => {
    it("sets dir=auto on the input so Arabic and Urdu render correctly", () => {
      render(<Harness secondaryLanguage="ARABIC" />);
      expect(screen.getByLabelText(/Name in Arabic/)).toHaveAttribute("dir", "auto");
    });

    it("directs only the input - not the label, button, or document", () => {
      const { container } = render(<Harness secondaryLanguage="ARABIC" />);
      const directed = Array.from(container.querySelectorAll("[dir]"));
      expect(directed).toHaveLength(1);
      expect(directed[0].tagName).toBe("INPUT");
      expect(document.documentElement).not.toHaveAttribute("dir");
    });
  });
});
