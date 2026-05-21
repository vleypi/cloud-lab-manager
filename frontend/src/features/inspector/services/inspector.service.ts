import { axiosInstance } from "@/shared/config/axios.config";

import {
  ICheckRun,
  ICheckSchedulePayload,
  ICheckScheduleAccepted,
  IInspectorTemplate,
} from "@/features/inspector/interfaces/inspector.interfaces";

class InspectorService {

  async schedule(
    standId: string,
    payload: ICheckSchedulePayload,
  ): Promise<ICheckScheduleAccepted> {
    const response = await axiosInstance.post<ICheckScheduleAccepted>(
      `/stands/${standId}/checks`,
      payload,
    );
    return response.data;
  }

  async listForStand(standId: string): Promise<ICheckRun[]> {
    const response = await axiosInstance.get<ICheckRun[]>(`/stands/${standId}/checks`);
    return response.data;
  }

  async getRun(runId: string): Promise<ICheckRun> {
    const response = await axiosInstance.get<ICheckRun>(`/checks/${runId}`);
    return response.data;
  }

  async listTemplates(): Promise<IInspectorTemplate[]> {
    const response = await axiosInstance.get<IInspectorTemplate[]>("/inspector/templates");
    return response.data;
  }
}

export const inspectorService = new InspectorService();
