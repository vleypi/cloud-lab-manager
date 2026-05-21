import { axiosInstance } from "@/shared/config/axios.config";

import {
  ICloudFlavor,
  ICloudImage,
  ICloudNetwork,
} from "@/features/cloud/interfaces/cloud.interfaces";

class CloudService {
  async listImages(): Promise<ICloudImage[]> {
    const response = await axiosInstance.get<ICloudImage[]>("/cloud/images");
    return response.data;
  }

  async listFlavors(): Promise<ICloudFlavor[]> {
    const response = await axiosInstance.get<ICloudFlavor[]>("/cloud/flavors");
    return response.data;
  }

  async listNetworks(): Promise<ICloudNetwork[]> {
    const response = await axiosInstance.get<ICloudNetwork[]>("/cloud/networks");
    return response.data;
  }
}

export const cloudService = new CloudService();
