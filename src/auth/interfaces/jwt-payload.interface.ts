export interface JwtPayload {
  userId: string;
  tenantId: string;
  roles: string[];
}
