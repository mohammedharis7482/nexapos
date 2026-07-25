"use client";

import { ChevronDown, Eye, EyeOff, Search } from "lucide-react";
import {
  cloneElement,
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactElement,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  controlSize?: "sm" | "md" | "lg";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, controlSize = "md", ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full rounded-[var(--radius-control)] border bg-surface px-3 text-foreground shadow-[var(--shadow-xs)] outline-none placeholder:text-foreground-muted transition-colors focus:border-border-focus focus:ring-4 focus:ring-[var(--focus-ring)] read-only:bg-surface-subtle disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-foreground-disabled",
        controlSize === "sm" && "min-h-[var(--control-sm)] text-sm",
        controlSize === "md" && "min-h-[var(--control-md)] text-[15px]",
        controlSize === "lg" && "min-h-[var(--control-lg)] px-4 text-base",
        invalid ? "border-danger focus:border-danger focus:ring-danger-border" : "border-input-border",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <span className="relative block min-w-0 w-full" data-slot="select-control">
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-[var(--control-md)] w-full cursor-pointer appearance-none truncate rounded-[var(--radius-control)] border bg-surface py-2 pl-3.5 pr-11 text-[15px] text-foreground shadow-[var(--shadow-xs)] outline-none transition-colors hover:border-border-strong focus:border-border-focus focus:ring-4 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-foreground-disabled",
        invalid ? "border-danger focus:border-danger focus:ring-danger-border" : "border-input-border",
        className,
      )}
      {...props}
    />
    <span className="pointer-events-none absolute inset-y-px right-px grid w-10 place-items-center rounded-r-[var(--radius-control)] text-foreground-muted" data-slot="select-indicator" aria-hidden="true">
      <ChevronDown className="size-4" />
    </span>
  </span>
));
Select.displayName = "Select";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      "min-h-24 w-full resize-y rounded-[var(--radius-control)] border bg-surface px-3.5 py-2.5 text-base text-text-primary outline-none transition-colors focus:border-primary focus:ring-4 focus:ring-[var(--focus-ring)] disabled:bg-surface-secondary disabled:text-disabled",
      invalid ? "border-danger" : "border-input-border",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-12", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-1 inline-flex w-11 items-center justify-center rounded-lg text-text-muted hover:text-text-primary"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean }>;
}) {
  const descriptionId = useId();
  const describedBy = error || hint ? descriptionId : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-foreground">
        {label}{required ? <span className="ml-1 text-danger" aria-hidden="true">*</span> : null}
      </label>
      {cloneElement(children, {
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : children.props["aria-invalid"],
      })}
      {error ? (
        <p id={descriptionId} className="text-sm font-medium text-danger" role="alert" aria-live="polite">
          {error}
        </p>
      ) : hint ? (
        <p id={descriptionId} className="text-sm text-foreground-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const SearchInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground-muted" aria-hidden="true" />
      <Input ref={ref} type="search" className={cn("pl-10", className)} {...props} />
    </div>
  ),
);
SearchInput.displayName = "SearchInput";

export const MoneyInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-foreground-muted">QAR</span>
      <Input ref={ref} inputMode="decimal" className={cn("pl-12 tabular-nums", className)} {...props} />
    </div>
  ),
);
MoneyInput.displayName = "MoneyInput";

export const QuantityInput = forwardRef<HTMLInputElement, InputProps & { unit?: string }>(
  ({ className, unit, ...props }, ref) => (
    <div className="relative">
      <Input ref={ref} inputMode="decimal" className={cn("tabular-nums", unit && "pr-16", className)} {...props} />
      {unit ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase text-foreground-muted">{unit}</span> : null}
    </div>
  ),
);
QuantityInput.displayName = "QuantityInput";

export const PercentageInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <div className="relative">
      <Input ref={ref} inputMode="decimal" className={cn("pr-9 tabular-nums", className)} {...props} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">%</span>
    </div>
  ),
);
PercentageInput.displayName = "PercentageInput";

export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const descriptionId = `${id}-description`;
  return (
    <div className={cn("flex min-h-11 items-start gap-3 rounded-lg py-1.5", className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-5 shrink-0 rounded border-border-strong accent-primary focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]" aria-describedby={description ? descriptionId : undefined} {...props} />
      <span><label htmlFor={id} className="block cursor-pointer text-sm font-semibold text-foreground">{label}</label>{description ? <span id={descriptionId} className="mt-0.5 block text-sm text-foreground-muted">{description}</span> : null}</span>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-[var(--radius-control)] border border-border bg-surface-subtle p-1">
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={cn("min-h-[var(--control-sm)] rounded-lg px-3 text-sm font-semibold transition-colors", value === option.value ? "bg-surface text-primary shadow-[var(--shadow-xs)]" : "text-foreground-secondary hover:text-foreground")}>{option.label}</button>
      ))}
    </div>
  );
}

export function RadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; description?: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-foreground">{label}</legend>
      {options.map((option) => (
        <label key={option.value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-border p-3 hover:bg-surface-hover">
          <input type="radio" name={label} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="mt-0.5 size-5 accent-primary focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]" />
          <span><span className="block text-sm font-semibold">{option.label}</span>{option.description ? <span className="mt-0.5 block text-sm text-foreground-muted">{option.description}</span> : null}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Switch({
  label,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onCheckedChange(!checked)} className="inline-flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50">
      <span className={cn("flex h-6 w-11 items-center rounded-full p-0.5 transition-colors", checked ? "bg-primary" : "bg-border-strong")} aria-hidden="true"><span className={cn("size-5 rounded-full bg-white shadow-[var(--shadow-xs)] transition-transform", checked && "translate-x-5")} /></span>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

export const NativeSelect = Select;
