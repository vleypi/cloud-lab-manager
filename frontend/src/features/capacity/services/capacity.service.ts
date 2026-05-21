import { axiosInstance } from "@/shared/config/axios.config";
import { ICapacityDecision } from "@/features/capacity/interfaces/capacity.interfaces";

class CapacityService {

  async getCurrent(): Promise<ICapacityDecision> {
    const response = await axiosInstance.get<ICapacityDecision>("/capacity");
    return response.data;
  }
}

export const capacityService = new CapacityService();
