"use client";

import { PageHeader } from "@/shared/ui/PageHeader";
import { CourseMappingsTable } from "@/features/mappings/components/CourseMappingsTable";

export default function AdminMappingsPage() {
  return (
    <>
      <PageHeader
        title="Маппинги курсов"
        description="Сопоставление Moodle context_id с доменом КИ, образом и flavor для каждой лабы"
      />
      <CourseMappingsTable />
    </>
  );
}
