# [Module Name] API Reference

## Overview

Brief description of the API endpoints provided by this module.

## Authentication

- **Required**: Yes/No
- **Type**: JWT Bearer Token
- **Permissions**: List required permissions
- **Tenant Isolation**: How tenant isolation is enforced

## Endpoints

### [HTTP Method] [Endpoint Path]

**Description**: What this endpoint does

**Authentication**: Required permissions and roles

**Request**:
```typescript
// Request interface
interface RequestDto {
  property: string;
  // Other properties
}
```

**Response**:
```typescript
// Response interface
interface ResponseDto {
  property: string;
  // Other properties
}
```

**Example Request**:
```bash
curl -X POST \
  http://localhost:3000/api/endpoint \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "property": "value"
  }'
```

**Example Response**:
```json
{
  "property": "value",
  "status": "success"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded

## Rate Limiting

- **Global Limit**: X requests per minute
- **Per-Tenant Limit**: Y requests per minute
- **Per-User Limit**: Z requests per minute

## Common Patterns

### Pagination
```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Filtering
```typescript
interface FilterOptions {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}
```

## Error Handling

All endpoints follow the standard error response format:

```typescript
interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}
```