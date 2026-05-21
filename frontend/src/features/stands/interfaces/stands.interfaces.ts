import { IPoolProject } from "@/features/pool/interfaces/pool.interfaces";

export type TStandStatus =
  | "allocating"
  | "deploying"
  | "ready"
  | "failed"
  | "frozen"
  | "cleaning"
  | "destroyed";

export interface IStand {
  id: string;
  owner_external_id: string;
  owner_display_name: string | null;
  status: TStandStatus;
  status_reason: string | null;

  course_code: string | null;
  lab_code: string | null;

  image_id: string;
  flavor_id: string;

  pool_project: IPoolProject;

  ki_server_id: string | null;
  ki_floating_ip: string | null;
  ssh_public_key_fingerprint: string | null;

  deployed_at: string | null;
  expires_at: string | null;
  destroyed_at: string | null;
  frozen_at: string | null;
  frozen_reason: string | null;

  incident_reported: boolean;
  incident_reported_by: string | null;
  incident_reported_at: string | null;
  incident_description: string | null;

  task_id: string | null;
  attempt: number;

  created_at: string;
  updated_at: string;
}

export interface IStandLaunchPayload {
  owner_external_id: string;
  owner_display_name?: string;
  image_id: string;
  flavor_id: string;
  course_code?: string;
  lab_code?: string;
  attach_floating_ip?: boolean;
}

export interface IStandLaunchAccepted {
  stand: IStand;
  task_id: string;
  credentials_url: string;
}

export interface IStandActionAccepted {
  stand: IStand;
  task_id: string | null;
}

export interface IStandCredentials {
  keypair_name: string;
  fingerprint: string;
  ssh_public_key: string;
  ssh_private_key: string;
}

export interface IFreezePayload {
  reason?: string;
  requested_by?: string;
}

export interface IUnfreezePayload {
  new_ttl_seconds?: number;
  requested_by?: string;
}

export interface IExtendPayload {
  new_ttl_seconds: number;
  requested_by?: string;
}

export interface IReportIncidentPayload {
  description: string;
  reported_by?: string;
}
