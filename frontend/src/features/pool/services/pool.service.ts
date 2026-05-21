import { axiosInstance } from "@/shared/config/axios.config";
import {
  IDiscoveredKiProject,
  IPoolBulkAddPayload,
  IPoolBulkAddResult,
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

  async discoverProjects(domainId?: string): Promise<IDiscoveredKiProject[]> {
    const response = await axiosInstance.get<IDiscoveredKiProject[]>("/pool/discover", {
      params: domainId ? { domain_id: domainId } : undefined,
    });
    return response.data;
  }

  async bulkAddProjects(payload: IPoolBulkAddPayload): Promise<IPoolBulkAddResult> {
    const response = await axiosInstance.post<IPoolBulkAddResult>(
      "/pool/projects/bulk",
      payload,
    );
    return response.data;
  }
}

export const poolService = new PoolService();
