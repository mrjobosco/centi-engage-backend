import { Request } from 'express';

export interface RequestUser {
  id: string;
  email: string;
  tenantId: string;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  roles: Array<{
    id: string;
    name: string;
    tenantId: string;
  }>;
}

export interface RequestWithUser extends Request {
  user: RequestUser;
}
