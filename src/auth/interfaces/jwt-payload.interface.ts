export interface JwtPayload {
  userId: string;
  tenantId: string | null;
  roles: string[];
  tokenType?: 'access' | 'refresh';
  sessionId?: string;
}
