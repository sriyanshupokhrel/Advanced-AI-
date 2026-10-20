import type { ConfirmationStatus } from "@/types/job";

const styles: Record<ConfirmationStatus, { label: string; className: string }> = {
  CONFIRMED: { label: "Confirmed", className: "bg-green-100 text-green-800 ring-green-600/20" },
  NOT_CONFIRMED: { label: "Not confirmed", className: "bg-slate-100 text-slate-700 ring-slate-500/20" },
  CHANGED_SINCE_CONFIRMATION: {
    label: "Changed since confirmation",
    className: "bg-amber-100 text-amber-800 ring-amber-600/20",
  },
};

export function ConfirmationBadge({ status }: { status: ConfirmationStatus }) {
  const { label, className } = styles[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {label}
    </span>
  );
}
