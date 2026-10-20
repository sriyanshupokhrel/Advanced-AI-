"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { targetApi } from "@/lib/api/api-client";

/** Unpairs a CV and job. The CV and the job description themselves are kept. */
export function RemoveTargetButton({ targetId, redirectTo }: { targetId: string; redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleRemove() {
    if (!window.confirm("Remove this pairing? The CV and the job description are kept.")) return;
    setBusy(true);
    const result = await targetApi.remove(targetId);
    setBusy(false);
    if (!result.ok && result.status !== 404) {
      window.alert(result.error.error);
      return;
    }
    if (redirectTo) router.push(redirectTo);
    else router.refresh();
  }

  return (
    <Button variant="danger" onClick={handleRemove} disabled={busy}>
      {busy ? "Removing…" : "Remove pairing"}
    </Button>
  );
}
