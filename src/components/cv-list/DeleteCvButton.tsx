"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cvApi } from "@/lib/api/api-client";

export function DeleteCvButton({ cvId, cvName }: { cvId: string; cvName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete the CV "${cvName}"? This also deletes its images and its job pairings (the job descriptions are kept). This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    const result = await cvApi.remove(cvId);
    setBusy(false);
    if (!result.ok && result.status !== 404) {
      window.alert(result.error.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="danger" onClick={handleDelete} disabled={busy} aria-label={`Delete ${cvName}`}>
      {busy ? "Deleting…" : "Delete"}
    </Button>
  );
}
