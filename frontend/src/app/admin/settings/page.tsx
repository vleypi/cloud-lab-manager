"use client";

import { PageHeader } from "@/shared/ui/PageHeader";
import { LifecycleSettingsForm } from "@/features/admin/components/LifecycleSettingsForm";

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader
        title="Лимиты системы"
        description="Глобальные тайм-ауты жизненного цикла стенда и порог утилизации КИ. Применяются к новым стендам без перезапуска сервиса"
      />
      <LifecycleSettingsForm />
    </>
  );
}
