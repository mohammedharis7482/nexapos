import { LoaderCircle } from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  leadingIcon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "border-primary bg-primary text-white shadow-sm hover:border-primary-hover hover:bg-primary-hover active:border-primary-active active:bg-primary-active",
  secondary:
    "border-border-strong bg-surface text-text-primary hover:border-input-border hover:bg-surface-secondary active:bg-slate-100",
  ghost:
    "border-transparent bg-transparent text-text-secondary hover:bg-surface-secondary hover:text-text-primary active:bg-slate-100",
  danger:
    "border-danger bg-danger text-white hover:border-red-700 hover:bg-red-700",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      loading = false,
      disabled,
      leadingIcon,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={cn(
        "inline-flex min-h-[var(--control-height)] items-center justify-center gap-2 rounded-[var(--radius-control)] border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-secondary disabled:text-disabled disabled:shadow-none",
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        leadingIcon
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      "inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] border border-transparent text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary active:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:text-disabled",
      className,
    )}
    {...props}
  />
));
IconButton.displayName = "IconButton";
