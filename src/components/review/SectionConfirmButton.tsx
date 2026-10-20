"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { targetApi } from "@/lib/api/api-client";
import type { ReviewSection } from "@/lib/validation/job-schema";
import type { ConfirmationStatus } from "@/types/job";

interface SectionConfirmButtonProps {
  targetId: string;
  section: ReviewSection;
  status: ConfirmationStatus;
  /** Fingerprint of the content shown on this page; sent so only that content is confirmed. */
  fingerprint: string;
}

/** Confirm / withdraw one section of the review page. */
export function SectionConfirmButton({ targetId, section, status, fingerprint }: SectionConfirmButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; stale: boolean } | null>(null);

  async function update(confirmed: boolean) {
    setBusy(true);
    setError(null);
    const result = await targetApi.setConfirmation(targetId, {
      confirmed,
      sections: [section],
      expectedFingerprints: confirmed ? { [section]: fingerprint } : undefined,
    });
    setBusy(false);
    if (!result.ok) return setError({ text: result.error.error, stale: result.status === 409 });
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {status === "CONFIRMED" ? (
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => update(false)} disabled={busy}>
          {busy ? "Saving…" : "Withdraw"}
        </Button>
      ) : (
        <Button className="px-3 py-1.5 text-xs" onClick={() => update(true)} disabled={busy}>
          {busy ? "Confirming…" : status === "CHANGED_SINCE_CONFIRMATION" ? "Confirm again" : "Confirm"}
        </Button>
      )}
      {error && (
        <p role="alert" className="max-w-xs text-right text-xs text-red-700">
          {error.text}{" "}
          {error.stale && (
            <button type="button" className="font-medium underline" onClick={() => router.refresh()}>
              Reload
            </button>
          )}
        </p>
      )}
    </div>
  );
}
