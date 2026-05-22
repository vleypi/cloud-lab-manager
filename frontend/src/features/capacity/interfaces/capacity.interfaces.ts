
export interface IResourceUsage {
  used: number;
  total: number;
  percent: number;
}

export interface IClusterUtilization {
  max_percent: number;
  vcpus: IResourceUsage;
  memory_mb: IResourceUsage;
  local_gb: IResourceUsage;
  running_vms: number;
}

export interface IFlavorRequirements {
  vcpus: number;
  ram_mb: number;
  disk_gb: number;
}

export interface ICapacityDecision {
  allowed: boolean;
  threshold_percent: number;
  reason: string | null;
  projected_max_percent: number | null;
  utilization: IClusterUtilization;
  flavor: IFlavorRequirements | null;
}
