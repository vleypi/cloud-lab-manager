"use client";

import { PageHeader } from "@/shared/ui/PageHeader";
import { PoolInventoryCard } from "@/features/pool/components/PoolInventoryCard";
import { PoolProjectsTable } from "@/features/pool/components/PoolProjectsTable";

export default function AdminPoolPage() {
  return (
    <>
      <PageHeader
        title="Пул проектов КИ"
        description="Управление предсозданными проектами для распределения студентам"
      />

      <div className="space-y-6">
        <PoolProjectsTable />
      </div>
    </>
  );
}
