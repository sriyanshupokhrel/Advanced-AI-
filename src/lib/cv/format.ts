const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2024-03" → "Mar 2024". Unrecognised values are returned unchanged. */
export function formatMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = MONTH_NAMES[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : value;
}

/** Builds "Mar 2021 – Present", "2019 – 2022"-style ranges from optional months. */
export function formatDateRange(start: string, end: string, isCurrent = false): string {
  const from = start ? formatMonth(start) : "";
  const to = isCurrent ? "Present" : end ? formatMonth(end) : "";
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "Data Analyst — Acme" style label; tolerates missing title or company. */
export function jobDisplayTitle(job: { title: string; companyName: string }): string {
  const title = job.title || "Untitled job";
  return job.companyName ? `${title} — ${job.companyName}` : title;
}
