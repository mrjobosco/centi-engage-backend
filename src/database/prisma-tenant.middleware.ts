import type { ITenantContext } from './interfaces/tenant-context.interface';

// Models that should NOT be tenant-scoped
const NON_TENANT_SCOPED_MODELS = ['Tenant'];

// Actions that require WHERE clause modification
const QUERY_ACTIONS = [
  'findUnique',
  'findFirst',
  'findMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
];

// Actions that require data modification
const CREATE_ACTIONS = ['create', 'createMany', 'upsert'];

export function createTenantScopingMiddleware(tenantContext: ITenantContext) {
  return (params: any, next: any) => {
    // Skip if model is not tenant-scoped
    if (!params.model || NON_TENANT_SCOPED_MODELS.includes(params.model)) {
      return next(params);
    }

    // Get current tenant ID
    const tenantId = tenantContext.getTenantId();

    // If no tenant context, skip middleware (e.g., during tenant registration)
    if (!tenantId) {
      return next(params);
    }

    // Add tenantId to WHERE clauses for query operations
    if (QUERY_ACTIONS.includes(params.action)) {
      if (!params.args) {
        params.args = {};
      }

      if (!params.args.where) {
        params.args.where = {};
      }

      // Add tenantId to where clause
      params.args.where = {
        ...params.args.where,
        tenantId,
      };
    }

    // Add tenantId to data for create operations
    if (CREATE_ACTIONS.includes(params.action)) {
      if (!params.args) {
        params.args = {};
      }

      if (params.action === 'create') {
        if (!params.args.data) {
          params.args.data = {};
        }
        params.args.data.tenantId = tenantId;
      } else if (params.action === 'createMany') {
        if (Array.isArray(params.args.data)) {
          params.args.data = params.args.data.map((item: any) => ({
            ...item,
            tenantId,
          }));
        }
      } else if (params.action === 'upsert') {
        if (!params.args.create) {
          params.args.create = {};
        }
        if (!params.args.update) {
          params.args.update = {};
        }
        params.args.create.tenantId = tenantId;
        // Also add to where clause for upsert
        if (!params.args.where) {
          params.args.where = {};
        }
        params.args.where.tenantId = tenantId;
      }
    }

    return next(params);
  };
}
