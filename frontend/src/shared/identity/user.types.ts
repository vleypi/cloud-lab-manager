

export interface IUser {
  id: string;
  externalId: string;
  email: string | null;
  displayName: string;
  isSuperAdmin: boolean;
}
