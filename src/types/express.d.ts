import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      tenantContext?: {
        tenantId: string | null;
        isTenantRequired: boolean;
      };
    }
  }
}
