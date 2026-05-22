"use client";

import { useParams } from "next/navigation";

import { ErrorBox } from "@/shared/ui/ErrorBox";
import { Spinner } from "@/shared/ui/Spinner";

import { StandConsole } from "@/features/stands/components/StandConsole";
import { useStand } from "@/features/stands/hooks/useStand";

export default function StandConsoleFullscreenPage() {
  const params = useParams<{ standId: string }>();
  const standId = params?.standId ?? null;
  const { data: stand, isLoading, error } = useStand(standId);

  if (isLoading || !stand) {
    return (
      <main className="min-h-[100dvh] bg-black flex items-center justify-center text-white">
        <Spinner size="lg" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-[100dvh] bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <ErrorBox error={error} title="Не удалось получить стенд" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-black">
      <StandConsole stand={stand} variant="fullscreen" showFullscreenLink={false} />
    </main>
  );
}
