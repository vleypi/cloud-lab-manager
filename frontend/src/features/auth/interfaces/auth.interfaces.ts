import { IUser } from "@/shared/identity/user.types";

export interface IAdminLoginPayload {
  email: string;
  password: string;
}

export interface IMeResponse {
  user: IUser;
}

export interface IIsAuthenticatedResponse {
  authenticated: boolean;
  isSuperAdmin: boolean;
  userId: string | null;
}

export interface IUserOutRaw {
  id: string;
  external_id: string;
  email: string | null;
  display_name: string;
  is_super_admin: boolean;
}

export interface IMeResponseRaw {
  user: IUserOutRaw;
}

export interface IIsAuthenticatedResponseRaw {
  authenticated: boolean;
  is_super_admin?: boolean;
  user_id?: string | null;
}
