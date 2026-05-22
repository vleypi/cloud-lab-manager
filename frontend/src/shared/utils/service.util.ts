import { AxiosError } from "axios";

export interface IApiErrorData {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
  detail?: string | Record<string, unknown>;
}

export class ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: Record<string, unknown>;

  constructor(message: string, statusCode: number, data: IApiErrorData = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = data.code;
    this.details = data.details;
  }
}

export function handleServiceError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    const responseData = error.response?.data as IApiErrorData | undefined;
    const statusCode = error.response?.status ?? 0;
    const detailText =
      typeof responseData?.detail === "string" ? responseData.detail : undefined;
    const message =
      responseData?.message ??
      detailText ??
      error.message ??
      "Произошла ошибка при запросе к серверу";
    return new ApiError(message, statusCode, responseData ?? {});
  }

  if (error instanceof Error) return new ApiError(error.message, 0);
  return new ApiError("Неизвестная ошибка", 0);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
