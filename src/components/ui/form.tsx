import * as React from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-control border border-line bg-surface px-3.5 text-body text-ink-900 shadow-1 transition-colors duration-[140ms] placeholder:text-ink-450 hover:border-line-strong focus-visible:border-pine-600 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-pine-100 disabled:cursor-not-allowed disabled:bg-canvas-sunk disabled:text-ink-500 aria-[invalid=true]:border-coral-600";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(control, "h-11", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={cn(control, "min-h-24 py-2.5 leading-6", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        control,
        "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%235E6B66%22 stroke-width=%222%22 viewBox=%220 0 24 24%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

type FieldProps = {
  label: string;
  htmlFor: string;
  helper?: React.ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** Top label + control + helper/inline error, wired with aria-describedby. */
export function Field({ label, htmlFor, helper, error, required, optional, className, children }: FieldProps) {
  const describedBy = error ? `${htmlFor}-error` : helper ? `${htmlFor}-help` : undefined;
  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: htmlFor,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        "aria-required": required || undefined,
      })
    : children;
  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-field={htmlFor}>
      <label htmlFor={htmlFor} className="text-small font-semibold text-ink-900">
        {label}
        {required && <span className="ml-0.5 text-coral-700" aria-hidden>*</span>}
        {optional && <span className="ml-1.5 font-medium text-ink-500">(optional)</span>}
      </label>
      {child}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-small font-medium text-coral-700" role="alert">
          {error}
        </p>
      ) : helper ? (
        <p id={`${htmlFor}-help`} className="text-small text-ink-500">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  id,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-body font-semibold text-ink-900">
          {label}
        </label>
        {description && <p className="text-small text-ink-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-[220ms]",
          checked ? "border-pine-600 bg-pine-600" : "border-line-strong bg-canvas-sunk",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-white shadow-1 transition-transform duration-[220ms] ease-grow",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-control bg-canvas-sunk p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-9 rounded-[9px] px-3 text-small font-semibold transition-all duration-[140ms]",
            value === o.value ? "bg-surface text-pine-700 shadow-1" : "text-ink-500 hover:text-ink-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
