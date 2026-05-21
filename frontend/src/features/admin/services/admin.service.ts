import { axiosInstance } from "@/shared/config/axios.config";
import {
  ILifecycleSettings,
  ILifecycleSettingsPatch,
} from "@/features/admin/interfaces/admin.interfaces";

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
}

export const adminService = new AdminService();
