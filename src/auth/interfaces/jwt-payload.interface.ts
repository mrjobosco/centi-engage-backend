export interface JwtPayload {
  userId: string;
  tenantId: string | null;
  roles: string[];
}
