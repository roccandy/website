import { afterEach, describe, expect, it, vi } from "vitest";
import type { MouseEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useFormStatus } from "react-dom";
import { AdminSubmitButton } from "./AdminSubmitButton";

vi.mock("react-dom", async (original) => ({ ...await original<typeof import("react-dom")>(), useFormStatus: vi.fn() }));

describe("admin submit feedback", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("preserves the action intent and ordinary button label", () => {
    vi.mocked(useFormStatus).mockReturnValue({ pending: false, data: null, method: null, action: null });
    const html = renderToStaticMarkup(<AdminSubmitButton type="submit" name="submit_intent" value="save_and_resend_confirmation">Save & resend confirmation</AdminSubmitButton>);
    expect(html).toContain('name="submit_intent"');
    expect(html).toContain('value="save_and_resend_confirmation"');
    expect(html).toContain('Save &amp; resend confirmation');
    expect(html).not.toContain('disabled');
  });
  it("disables repeat submissions and announces the pending state", () => {
    vi.mocked(useFormStatus).mockReturnValue({ pending: true, data: new FormData(), method: "post", action: "/admin" });
    const html = renderToStaticMarkup(<AdminSubmitButton type="submit" pendingLabel="Saving order…">Save</AdminSubmitButton>);
    expect(html).toContain('disabled');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Saving order…');
  });
  it("retains caller-supplied access/validation restrictions", () => {
    vi.mocked(useFormStatus).mockReturnValue({ pending: false, data: null, method: null, action: null });
    expect(renderToStaticMarkup(<AdminSubmitButton disabled>Save</AdminSubmitButton>)).toContain('disabled');
  });
  it("allows a consequential action to be cancelled before submission", () => {
    vi.mocked(useFormStatus).mockReturnValue({ pending: false, data: null, method: null, action: null });
    const confirm = vi.fn(() => false), preventDefault = vi.fn();
    vi.stubGlobal("window", { confirm });
    const button = AdminSubmitButton({ children: "Merge", confirmMessage: "Merge these records?" });
    button.props.onClick({ defaultPrevented: false, preventDefault } as unknown as MouseEvent<HTMLButtonElement>);
    expect(confirm).toHaveBeenCalledWith("Merge these records?");
    expect(preventDefault).toHaveBeenCalledOnce();
  });
  it("respects an existing click handler that cancels an action", () => {
    vi.mocked(useFormStatus).mockReturnValue({ pending: false, data: null, method: null, action: null });
    const confirm = vi.fn();
    vi.stubGlobal("window", { confirm });
    const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    const button = AdminSubmitButton({ children: "Delete", confirmMessage: "Delete?", onClick: (click) => click.preventDefault() });
    button.props.onClick(event as unknown as MouseEvent<HTMLButtonElement>);
    expect(event.defaultPrevented).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
});
