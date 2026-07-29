import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import RegisterShopPage from "./page";

const register = vi.fn();
const resendVerification = vi.fn();
vi.mock("@/services/saas.service", () => ({
  saasService: {
    register: (...args: unknown[]) => register(...args),
    resendVerification: (...args: unknown[]) => resendVerification(...args),
  },
}));

const success = {
  success: true,
  message: "Shop registered. Check your email to verify the account.",
  data: {
    shop: {
      id: "02dccdd7-8182-4554-b1db-60bcaa610002",
      name: "Test Grocery",
    },
    owner: { username: "owner" },
    verification_required: true as const,
    owner_email: "owner@example.test",
    registration_status: "PENDING_VERIFICATION" as const,
    email_delivery: "DEVELOPMENT_CONSOLE" as const,
    next_step: "VERIFY_EMAIL" as const,
  },
};

async function fillForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Shop name"), "Test Grocery");
  await user.type(screen.getByLabelText("Owner full name"), "Test Owner");
  await user.type(screen.getByLabelText("Owner email"), "owner@example.test");
  await user.type(screen.getByLabelText("Owner username"), "owner");
  await user.type(screen.getByLabelText("Password"), "StrongPassword123!");
  await user.type(screen.getByLabelText("Confirm password"), "StrongPassword123!");
  await user.type(screen.getByLabelText("Shop address"), "Doha");
  await user.type(screen.getByLabelText("Phone"), "+97450000000");
  return user;
}

describe("shop registration", () => {
  beforeEach(() => {
    register.mockReset();
    register.mockResolvedValue(success);
    resendVerification.mockReset();
    resendVerification.mockResolvedValue({
      success: true,
      message: "If an unverified account exists, a verification email has been sent.",
      data: null,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("submits one request and replaces the form with an accessible success panel", async () => {
    render(<RegisterShopPage />);
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/plan/i)).not.toBeInTheDocument();

    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Create shop" }));

    await waitFor(() => expect(register).toHaveBeenCalledOnce());
    expect(register.mock.calls[0][0]).toMatchObject({
      country: "Qatar",
      currency: "QAR",
      timezone: "Asia/Qatar",
    });
    expect(await screen.findByRole("heading", { name: "Shop registered" })).toHaveFocus();
    expect(screen.getByText("owner@example.test")).toBeInTheDocument();
    expect(screen.getByText(success.data.shop.id)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue to Sign In" })).toHaveAttribute(
      "href",
      `/login?shop_id=${success.data.shop.id}`,
    );
    expect(screen.getByRole("button", { name: "Resend Verification Email" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create shop" })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/token/i);
  });

  it("shows an immediate sign-in handoff when verification is disabled", async () => {
    register.mockResolvedValue({
      ...success,
      message: "Shop created successfully.",
      data: {
        ...success.data,
        verification_required: false,
        registration_status: "ONBOARDING",
        email_delivery: "NOT_REQUIRED",
        next_step: "SIGN_IN",
      },
    });
    render(<RegisterShopPage />);
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Create shop" }));

    expect(
      await screen.findByRole("heading", {
        name: "Shop created successfully",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/workspace is ready/i)).toBeInTheDocument();
    expect(screen.getByText(success.data.shop.id)).toBeInTheDocument();
    expect(screen.getByText(/Username:/)).toHaveTextContent("owner");
    expect(
      screen.getByRole("link", { name: "Continue to Sign In" }),
    ).toHaveAttribute("href", `/login?shop_id=${success.data.shop.id}`);
    expect(
      screen.queryByRole("button", { name: "Resend Verification Email" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/verification link/i)).not.toBeInTheDocument();
  });

  it("copies the Shop ID and announces feedback", async () => {
    render(<RegisterShopPage />);
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Create shop" }));
    await screen.findByRole("heading", { name: "Shop registered" });

    await user.click(screen.getByRole("button", { name: "Copy Shop ID" }));

    expect(await navigator.clipboard.readText()).toBe(success.data.shop.id);
    expect(screen.getByRole("button", { name: "Shop ID copied" })).toBeInTheDocument();
    expect(screen.getByText("Shop ID copied to clipboard.")).toBeInTheDocument();
  });

  it("resends verification with the registered email and generic feedback", async () => {
    render(<RegisterShopPage />);
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Create shop" }));
    await screen.findByRole("heading", { name: "Shop registered" });

    await user.click(screen.getByRole("button", { name: "Resend Verification Email" }));

    expect(resendVerification).toHaveBeenCalledWith({
      email: success.data.owner_email,
    });
    expect(await screen.findByText(/If an unverified account exists/)).toBeInTheDocument();
  });

  it("shows accurate SMTP delivery wording", async () => {
    register.mockResolvedValue({
      ...success,
      data: { ...success.data, email_delivery: "EMAIL_SENT" },
    });
    render(<RegisterShopPage />);
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Create shop" }));

    expect(await screen.findByText(/A verification email was sent to/)).toBeInTheDocument();
    expect(screen.queryByText(/Django server terminal/)).not.toBeInTheDocument();
  });

  it("retains the Shop ID and resend action when delivery fails", async () => {
    register.mockResolvedValue({
      ...success,
      message:
        "Your shop was created, but the verification email could not be delivered.",
      data: { ...success.data, email_delivery: "EMAIL_DELIVERY_FAILED" },
    });
    render(<RegisterShopPage />);
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Create shop" }));

    expect(await screen.findByText(/could not be delivered/)).toBeInTheDocument();
    expect(screen.getByText(success.data.shop.id)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend Verification Email" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows generic possible-existing-account recovery guidance", async () => {
    register.mockRejectedValue(
      new ApiError(
        "An account may already exist with these details. Sign in or request another verification message.",
        400,
        {},
        "ACCOUNT_MAY_EXIST",
      ),
    );
    render(<RegisterShopPage />);
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Create shop" }));

    expect(await screen.findByText(/account may already exist/i)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("synchronously guards double submission while the request is pending", async () => {
    let resolveRequest!: (value: typeof success) => void;
    register.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    render(<RegisterShopPage />);
    await fillForm();
    const form = screen.getByRole("button", { name: "Create shop" }).closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    fireEvent.submit(form!);

    expect(register).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Create shop" })).toBeDisabled();
    resolveRequest(success);
    expect(await screen.findByRole("heading", { name: "Shop registered" })).toBeInTheDocument();
  });

  it("pressing Enter uses the form submission path once", async () => {
    render(<RegisterShopPage />);
    const user = await fillForm();
    await user.type(screen.getByLabelText("Phone"), "{Enter}");

    await waitFor(() => expect(register).toHaveBeenCalledOnce());
  });

  it("clears prior general and field errors when a corrected retry succeeds", async () => {
    register
      .mockRejectedValueOnce(new ApiError("Please check the entered details.", 400, {
        owner_email: ["An account with this email cannot be registered."],
      }))
      .mockResolvedValueOnce(success);
    render(<RegisterShopPage />);
    const user = await fillForm();

    await user.click(screen.getByRole("button", { name: "Create shop" }));
    expect(await screen.findByText("Please check the entered details.")).toBeInTheDocument();
    expect(screen.getByText("An account with this email cannot be registered.")).toBeInTheDocument();
    expect(screen.getByLabelText("Owner email")).toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByRole("button", { name: "Create shop" }));
    expect(await screen.findByRole("heading", { name: "Shop registered" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows only validation state for an HTTP 400 and preserves values", async () => {
    register.mockRejectedValue(new ApiError("Please check the entered details.", 400, {
      owner_email: ["Enter a valid email address."],
      non_field_errors: ["Registration could not be validated."],
    }));
    render(<RegisterShopPage />);
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: "Create shop" }));

    expect(await screen.findByText("Registration could not be validated.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByLabelText("Owner email")).toHaveValue("owner@example.test");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Owner email")).toHaveFocus());
    expect(screen.getByRole("button", { name: "Create shop" })).toBeEnabled();
  });

  it("shows one controlled network error and permits an explicit retry", async () => {
    register
      .mockRejectedValueOnce(new ApiError("NexaPOS cannot reach the server.", 0))
      .mockResolvedValueOnce(success);
    render(<RegisterShopPage />);
    const user = await fillForm();

    await user.click(screen.getByRole("button", { name: "Create shop" }));
    expect(await screen.findByText("NexaPOS cannot reach the server.")).toBeInTheDocument();
    expect(register).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Create shop" }));
    expect(await screen.findByRole("heading", { name: "Shop registered" })).toBeInTheDocument();
    expect(register).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
