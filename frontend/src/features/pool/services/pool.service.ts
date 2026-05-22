import { axiosInstance } from "@/shared/config/axios.config";
import {
  IPoolInventory,
  IPoolProject,
  IPoolProjectCreatePayload,
} from "@/features/pool/interfaces/pool.interfaces";

class PoolService {
  async getInventory(): Promise<IPoolInventory> {
    const response = await axiosInstance.get<IPoolInventory>("/pool/inventory");
    return response.data;
  }

  async listProjects(): Promise<IPoolProject[]> {
    const response = await axiosInstance.get<IPoolProject[]>("/pool/projects");
    return response.data;
  }

  async addProject(payload: IPoolProjectCreatePayload): Promise<IPoolProject> {
    const response = await axiosInstance.post<IPoolProject>("/pool/projects", payload);
    return response.data;
  }

  async deleteProject(projectId: string): Promise<void> {
    await axiosInstance.delete(`/pool/projects/${projectId}`);
  }
}

export const poolService = new PoolService();
