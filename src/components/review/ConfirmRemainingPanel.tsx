"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { targetApi } from "@/lib/api/api-client";
import { REVIEW_SECTION_LABELS, type ReviewSection } from "@/lib/validation/job-schema";

interface ConfirmRemainingPanelProps {
  targetId: string;
  /** Sections not currently confirmed, with the fingerprints shown on this page. */
  pending: { section: ReviewSection; fingerprint: string }[];
  /** Images still needing review (they are confirmed individually). */
  pendingImages: number;
}

/**
 * Confirms all remaining sections in one step, after the user ticks that they
 * reviewed them. Images are deliberately excluded: each image's description
 * and project link must be confirmed on its own card.
 */
export function ConfirmRemainingPanel({ targetId, pending, pendingImages }: ConfirmRemainingPanelProps) {
  const router = useRouter();
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pending.length === 0) return null;

  async function confirmAll() {
    setBusy(true);
    setError(null);
    const result = await targetApi.setConfirmation(targetId, {
      confirmed: true,
      sections: pending.map((p) => p.section),
      expectedFingerprints: Object.fromEntries(pending.map((p) => [p.section, p.fingerprint])),
    });
    setBusy(false);
    if (!result.ok) return setError(result.error.error);
    setReviewed(false);
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 sm:p-5" aria-labelledby="confirm-remaining">
      <h2 id="confirm-remaining" className="text-base font-semibold text-slate-900">
        Confirm the remaining sections
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        Still to confirm: {pending.map((p) => REVIEW_SECTION_LABELS[p.section]).join(", ")}.
        {pendingImages > 0 &&
          ` ${pendingImages} image${pendingImages === 1 ? " also needs" : "s also need"} to be confirmed individually below.`}
      </p>
      <label className="mt-3 flex items-start gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(event) => setReviewed(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
        />
        I have reviewed these sections and they are accurate. I understand this is my own confirmation, not an
        independent verification.
      </label>
      <Button className="mt-3" onClick={confirmAll} disabled={!reviewed || busy}>
        {busy ? "Confirming…" : `Confirm ${pending.length} section${pending.length === 1 ? "" : "s"}`}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}{" "}
          <button type="button" className="font-medium underline" onClick={() => router.refresh()}>
            Reload
          </button>
        </p>
      )}
    </section>
  );
}
