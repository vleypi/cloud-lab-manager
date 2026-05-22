"use client";

import { PageHeader } from "@/shared/ui/PageHeader";
import { CourseMappingsTable } from "@/features/mappings/components/CourseMappingsTable";
import { PendingLtiBindingsCard } from "@/features/mappings/components/PendingLtiBindingsCard";

export default function AdminMappingsPage() {
  return (
    <>
      <PageHeader
        title="Маппинги курсов"
        description="Сопоставление Moodle context_id с доменом КИ, образом и flavor для каждой лабы"
      />
      <PendingLtiBindingsCard />
      <CourseMappingsTable />
    </>
  );
}
