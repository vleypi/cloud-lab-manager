

export type TPoolProjectStatus = "free" | "allocated" | "cleaning" | "disabled";

export interface IPoolProject {
  id: string;
  ki_project_id: string;
  ki_project_name: string;
  ki_domain_id: string;
  ki_domain_name: string;
  ki_network_id: string | null;
  ki_router_id: string | null;
  status: TPoolProjectStatus;
  last_released_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IPoolProjectCreatePayload {
  ki_project_id: string;
  ki_project_name: string;
  ki_domain_id: string;
  ki_domain_name: string;
  ki_network_id?: string;
  ki_router_id?: string;
}

export interface IPoolInventory {
  free: number;
  allocated: number;
  cleaning: number;
  disabled: number;
}

