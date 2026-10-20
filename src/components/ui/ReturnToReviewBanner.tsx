import Link from "next/link";

/** Shown in the editors when the user arrived from the review page. */
export function ReturnToReviewBanner({ href }: { href: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-900">
      <span>You are correcting information from the review page. Save your changes, then go back to confirm them.</span>
      <Link href={href} className="font-medium underline">
        ← Back to review
      </Link>
    </div>
  );
}
