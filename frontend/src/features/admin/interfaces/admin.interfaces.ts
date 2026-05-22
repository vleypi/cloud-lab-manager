
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

export interface ILifecycleSettingChange {
  id: string;
  created_at: string;
  key: string;
  old_value: string | null;
  new_value: string;
  updated_by: string | null;
}

export interface ILifecycleSettingsHistory {
  items: ILifecycleSettingChange[];
  total: number;
  limit: number;
  offset: number;
}
