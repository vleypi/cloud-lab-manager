import { axiosInstance } from "@/shared/config/axios.config";
import {
  ILtiPlatform,
  ILtiPlatformPayload,
} from "@/features/platforms/interfaces/platforms.interfaces";

class PlatformsService {
  async list(): Promise<ILtiPlatform[]> {
    const response = await axiosInstance.get<ILtiPlatform[]>("/lti/platforms");
    return response.data;
  }

  async create(payload: ILtiPlatformPayload): Promise<ILtiPlatform> {
    const response = await axiosInstance.post<ILtiPlatform>("/lti/platforms", payload);
    return response.data;
  }
}

export const platformsService = new PlatformsService();
