"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { jobApi } from "@/lib/api/api-client";

interface DeleteJobButtonProps {
  jobId: string;
  jobLabel: string;
  targetCount: number;
  /** Navigate here after deleting; otherwise the current page is refreshed. */
  redirectTo?: string;
}

export function DeleteJobButton({ jobId, jobLabel, targetCount, redirectTo }: DeleteJobButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    const pairings =
      targetCount > 0
        ? ` It is paired with ${targetCount} CV${targetCount === 1 ? "" : "s"}; those pairings will also be removed (the CVs are kept).`
        : "";
    if (!window.confirm(`Delete "${jobLabel}"?${pairings} This cannot be undone.`)) return;

    setBusy(true);
    const result = await jobApi.remove(jobId);
    setBusy(false);
    if (!result.ok && result.status !== 404) {
      window.alert(result.error.error);
      return;
    }
    if (redirectTo) router.push(redirectTo);
    else router.refresh();
  }

  return (
    <Button variant="danger" onClick={handleDelete} disabled={busy} aria-label={`Delete ${jobLabel}`}>
      {busy ? "Deleting…" : "Delete"}
    </Button>
  );
}
