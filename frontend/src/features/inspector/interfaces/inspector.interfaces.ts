

export type TCheckRunStatus = "pending" | "running" | "passed" | "failed" | "error";

export type TCheckResultStatus = "passed" | "failed" | "skipped" | "error";

export type TCheckKind =
  | "package_installed"
  | "systemd_active"
  | "port_listening"
  | "file_exists"
  | "file_contains"
  | "command_exit_zero"
  | "command_output_matches"
  | "os_release"
  | "user_exists"
  | "process_running"
  | "http_endpoint"
  | "dns_resolves"
  | "command_output_compare"
  | string;

export type TCheckSection = "os" | "software" | "network" | "other" | string;
export type TCheckSeverity = "critical" | "warning" | "info" | string;

export interface ICheckResult {
  id: string;
  position: number;
  name: string;
  kind: TCheckKind;
  status: TCheckResultStatus;
  message: string | null;
  stdout: string | null;
  stderr: string | null;
  exit_code: number | null;
  duration_ms: number | null;
  spec: Record<string, unknown>;
  section: TCheckSection;
  severity: TCheckSeverity;
}

export interface ICheckRun {
  id: string;
  stand_id: string;
  template_name: string;
  template_version: string | null;
  requested_by: string | null;
  status: TCheckRunStatus;
  summary: string | null;
  task_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  total: number;
  passed: number;
  failed: number;
  errored: number;
  results: ICheckResult[];
  created_at: string;
  updated_at: string;
}

export interface ICheckSchedulePayload {
  template_name: string;
  requested_by?: string;
}

export interface ICheckScheduleAccepted {
  run: ICheckRun;
  task_id: string;
}

export interface IInspectorTemplate {
  name: string;
  display_name: string;
  description: string | null;
  version: string | null;
  checks_count: number;
}
