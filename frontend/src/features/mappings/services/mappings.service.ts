import { axiosInstance } from "@/shared/config/axios.config";
import {
  ICourseMapping,
  ICourseMappingPayload,
  ILabLaunchPayload,
  IPendingLtiBinding,
} from "@/features/mappings/interfaces/mappings.interfaces";
import { IStandLaunchAccepted } from "@/features/stands/interfaces/stands.interfaces";

class MappingsService {
  async upsert(payload: ICourseMappingPayload): Promise<ICourseMapping> {
    const response = await axiosInstance.post<ICourseMapping>("/lti/mappings", payload);
    return response.data;
  }

  async list(ltiContextId?: string): Promise<ICourseMapping[]> {
    const response = await axiosInstance.get<ICourseMapping[]>("/lti/mappings", {
      params: ltiContextId ? { lti_context_id: ltiContextId } : undefined,
    });
    return response.data;
  }

  async delete(mappingId: string): Promise<void> {
    await axiosInstance.delete(`/lti/mappings/${mappingId}`);
  }

  async launchFor(
    mappingId: string,
    payload: ILabLaunchPayload,
  ): Promise<IStandLaunchAccepted> {
    const response = await axiosInstance.post<IStandLaunchAccepted>(
      `/lti/mappings/${mappingId}/launch`,
      payload,
    );
    return response.data;
  }

  async listPendingBindings(): Promise<IPendingLtiBinding[]> {
    const response = await axiosInstance.get<IPendingLtiBinding[]>("/lti/pending-bindings");
    return response.data;
  }

  async dismissPendingBinding(bindingId: string): Promise<void> {
    await axiosInstance.delete(`/lti/pending-bindings/${bindingId}`);
  }
}

export const mappingsService = new MappingsService();
