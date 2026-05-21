"use client";

import { PageHeader } from "@/shared/ui/PageHeader";
import { LtiPlatformsTable } from "@/features/platforms/components/LtiPlatformsTable";

export default function AdminPlatformsPage() {
  return (
    <>
      <PageHeader
        title="LTI платформы"
        description="Доверенные Moodle инстанции, из которых принимаем id_token"
      />
      <LtiPlatformsTable />
    </>
  );
}
