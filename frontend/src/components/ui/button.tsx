import { LoaderCircle } from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type Variant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "danger"
  | "success"
  | "link";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "border-primary bg-primary text-white shadow-sm hover:border-primary-hover hover:bg-primary-hover active:border-primary-active active:bg-primary-active",
  secondary:
    "border-border-strong bg-surface text-foreground shadow-[var(--shadow-xs)] hover:bg-surface-hover active:bg-surface-muted",
  outline:
    "border-brand-200 bg-surface text-primary hover:border-brand-300 hover:bg-primary-soft active:bg-brand-100",
  ghost:
    "border-transparent bg-transparent text-foreground-secondary hover:bg-surface-hover hover:text-foreground active:bg-surface-muted",
  destructive:
    "border-danger bg-danger text-white hover:bg-danger-hover active:bg-danger-active",
  danger:
    "border-danger bg-danger text-white hover:bg-danger-hover active:bg-danger-active",
  success:
    "border-success bg-success text-white hover:bg-success-hover active:bg-success-active",
  link:
    "border-transparent bg-transparent px-0 text-primary underline-offset-4 hover:underline",
};

const sizes: Record<Size, string> = {
  sm: "min-h-[var(--control-sm)] px-3 text-xs",
  md: "min-h-[var(--control-md)] px-4 text-sm",
  lg: "min-h-[var(--control-lg)] px-5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      leadingIcon,
      trailingIcon,
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
        "relative inline-flex items-center justify-center rounded-[var(--radius-control)] border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-foreground-disabled disabled:shadow-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="absolute size-4 animate-spin" aria-hidden="true" /> : null}
      <span className={cn("inline-flex items-center justify-center gap-2", loading && "invisible")}>
        {leadingIcon}
        {children}
        {trailingIcon}
      </span>
    </button>
  ),
);
Button.displayName = "Button";

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { size?: Size; variant?: "ghost" | "secondary" | "destructive" }
>(({ className, type = "button", size = "md", variant = "ghost", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      "inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] border border-transparent text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary active:bg-surface-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:text-disabled",
      size === "sm" && "size-[var(--icon-button-sm)]",
      size === "md" && "size-[var(--icon-button-md)]",
      size === "lg" && "size-[var(--icon-button-lg)]",
      variant === "secondary" && "border-border-strong bg-surface shadow-[var(--shadow-xs)]",
      variant === "destructive" && "text-danger hover:bg-danger-soft",
      className,
    )}
    {...props}
  />
));
IconButton.displayName = "IconButton";
