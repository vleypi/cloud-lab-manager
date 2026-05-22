import { axiosInstance } from "@/shared/config/axios.config";
import {
  ILifecycleSettings,
  ILifecycleSettingsHistory,
  ILifecycleSettingsPatch,
} from "@/features/admin/interfaces/admin.interfaces";

interface IGetHistoryParams {
  key?: string;
  limit?: number;
  offset?: number;
}

class AdminService {
  async getLifecycleSettings(): Promise<ILifecycleSettings> {
    const response = await axiosInstance.get<ILifecycleSettings>("/admin/lifecycle-settings");
    return response.data;
  }

  async patchLifecycleSettings(
    payload: ILifecycleSettingsPatch,
  ): Promise<ILifecycleSettings> {
    const response = await axiosInstance.patch<ILifecycleSettings>(
      "/admin/lifecycle-settings",
      payload,
    );
    return response.data;
  }

  async getLifecycleHistory(
    params: IGetHistoryParams = {},
  ): Promise<ILifecycleSettingsHistory> {
    const response = await axiosInstance.get<ILifecycleSettingsHistory>(
      "/admin/lifecycle-settings/history",
      { params },
    );
    return response.data;
  }
}

export const adminService = new AdminService();
