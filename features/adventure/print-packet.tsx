"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { requestJson } from "@/features/shared/api-client";
export function PrintPacketButton({
  campaignId,
  sessionId,
  disabled,
}: {
  campaignId: string;
  sessionId: string;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={disabled || busy}
      title="Uses saved data; save drafts before generating"
      onClick={async () => {
        setBusy(true);
        try {
          const { html } = await requestJson<{ html: string }>(
            `/api/campaigns/${campaignId}/sessions/${sessionId}/packet`,
          );
          const url = URL.createObjectURL(
            new Blob([html], { type: "text/html" }),
          );
          const link = document.createElement("a");
          link.href = url;
          link.download = "dm-session-packet.html";
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Could not create packet",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      Download printable packet
    </Button>
  );
}
