
export interface ILifecycleSettings {
  stand_default_ttl_seconds: number;
  stand_freeze_ttl_seconds: number;
  capacity_threshold_percent: number;
}

export interface ILifecycleSettingsPatch {
  stand_default_ttl_seconds?: number;
  stand_freeze_ttl_seconds?: number;
  capacity_threshold_percent?: number;
  updated_by?: string;
}
