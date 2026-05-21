import { axiosInstance } from "@/shared/config/axios.config";

import {
  IExtendPayload,
  IFreezePayload,
  IReportIncidentPayload,
  IStand,
  IStandActionAccepted,
  IStandCredentials,
  IStandLaunchAccepted,
  IStandLaunchPayload,
  IUnfreezePayload,
} from "@/features/stands/interfaces/stands.interfaces";

class StandsService {

  async launch(payload: IStandLaunchPayload): Promise<IStandLaunchAccepted> {
    const response = await axiosInstance.post<IStandLaunchAccepted>("/stands", payload);
    return response.data;
  }

  async get(standId: string): Promise<IStand> {
    const response = await axiosInstance.get<IStand>(`/stands/${standId}`);
    return response.data;
  }

  async listForOwner(ownerExternalId: string): Promise<IStand[]> {
    const response = await axiosInstance.get<IStand[]>("/stands", {
      params: { owner_external_id: ownerExternalId },
    });
    return response.data;
  }

  async listAll(params: { status?: string; limit?: number } = {}): Promise<IStand[]> {
    const response = await axiosInstance.get<IStand[]>("/admin/stands", { params });
    return response.data;
  }

  async getCredentials(standId: string): Promise<IStandCredentials> {
    const response = await axiosInstance.get<IStandCredentials>(
      `/stands/${standId}/credentials`,
    );
    return response.data;
  }

  async destroy(standId: string): Promise<IStandActionAccepted> {
    const response = await axiosInstance.delete<IStandActionAccepted>(`/stands/${standId}`);
    return response.data;
  }

  async freeze(standId: string, payload: IFreezePayload): Promise<IStand> {
    const response = await axiosInstance.post<IStand>(`/stands/${standId}/freeze`, payload);
    return response.data;
  }

  async unfreeze(standId: string, payload: IUnfreezePayload): Promise<IStand> {
    const response = await axiosInstance.post<IStand>(`/stands/${standId}/unfreeze`, payload);
    return response.data;
  }

  async extend(standId: string, payload: IExtendPayload): Promise<IStand> {
    const response = await axiosInstance.post<IStand>(`/stands/${standId}/extend`, payload);
    return response.data;
  }

  async reportIncident(standId: string, payload: IReportIncidentPayload): Promise<IStand> {
    const response = await axiosInstance.post<IStand>(
      `/stands/${standId}/report-incident`,
      payload,
    );
    return response.data;
  }
}

export const standsService = new StandsService();
