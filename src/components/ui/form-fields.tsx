import type { ReactNode } from "react";

/** DOM id for a field path such as "experience.0.role" (used to focus errors). */
export const fieldId = (path: string) => `field-${path.replace(/\./g, "-")}`;

const inputBase =
  "w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2";
const inputState = (error?: string) =>
  error
    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
    : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200";

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

function FieldShell({ id, label, required, hint, error, className, children }: FieldShellProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, hint?: string, error?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

interface BaseFieldProps {
  path: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  error?: string;
  placeholder?: string;
  className?: string;
}

interface TextFieldProps extends BaseFieldProps {
  type?: "text" | "email" | "tel" | "url" | "month";
  autoComplete?: string;
  disabled?: boolean;
}

export function TextField({
  path,
  label,
  value,
  onChange,
  required,
  hint,
  error,
  placeholder,
  className,
  type = "text",
  autoComplete,
  disabled,
}: TextFieldProps) {
  const id = fieldId(path);
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <input
        id={id}
        name={path}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, hint, error)}
        className={`${inputBase} ${inputState(error)} disabled:bg-slate-100 disabled:text-slate-400`}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  path,
  label,
  value,
  onChange,
  required,
  hint,
  error,
  placeholder,
  className,
  rows = 4,
}: BaseFieldProps & { rows?: number }) {
  const id = fieldId(path);
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <textarea
        id={id}
        name={path}
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, hint, error)}
        className={`${inputBase} ${inputState(error)} resize-y`}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends BaseFieldProps {
  options: { value: string; label: string }[];
}

export function SelectField({
  path,
  label,
  value,
  onChange,
  required,
  hint,
  error,
  className,
  options,
}: SelectFieldProps) {
  const id = fieldId(path);
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <select
        id={id}
        name={path}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, hint, error)}
        className={`${inputBase} ${inputState(error)}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

interface CheckboxFieldProps {
  path: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function CheckboxField({ path, label, checked, onChange, className }: CheckboxFieldProps) {
  const id = fieldId(path);
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <input
        id={id}
        name={path}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      <label htmlFor={id} className="text-sm text-slate-700">
        {label}
      </label>
    </div>
  );
}
