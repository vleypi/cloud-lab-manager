import { axiosInstance } from "@/shared/config/axios.config";
import { IUser } from "@/shared/identity/user.types";

import {
  IAdminLoginPayload,
  IMeResponse,
  IMeResponseRaw,
  IUserOutRaw,
} from "@/features/auth/interfaces/auth.interfaces";

class AuthService {
  async me(): Promise<IMeResponse> {
    const { data } = await axiosInstance.get<IMeResponseRaw>("/auth/me");
    return { user: this.adaptUser(data.user) };
  }

  async adminLogin(payload: IAdminLoginPayload): Promise<IMeResponse> {
    const { data } = await axiosInstance.post<IMeResponseRaw>("/auth/admin/login", payload);
    return { user: this.adaptUser(data.user) };
  }

  async refresh(): Promise<IMeResponse> {
    const { data } = await axiosInstance.post<IMeResponseRaw>("/auth/refresh");
    return { user: this.adaptUser(data.user) };
  }

  async logout(): Promise<void> {
    await axiosInstance.post("/auth/logout");
  }

  private adaptUser(raw: IUserOutRaw): IUser {
    return {
      id: raw.id,
      externalId: raw.external_id,
      email: raw.email,
      displayName: raw.display_name,
      isSuperAdmin: raw.is_super_admin,
    };
  }
}

export const authService = new AuthService();
