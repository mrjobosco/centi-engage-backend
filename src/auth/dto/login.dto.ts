import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    description: 'Persist login session across browser restarts',
    example: true,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

/**
 * {
  "message": "Tenant created successfully",
  "data": {
    "tenant": {
      "id": "cmge1zgeb0000vdcgu6ncw6h8",
      "name": "Acme Corporation",
      "subdomain": null,
      "createdAt": "2025-10-05T18:46:27.779Z",
      "updatedAt": "2025-10-05T18:46:27.779Z"
    },
    "adminUser": {
      "id": "cmge1zgfa0010vdcggrzg060t",
      "email": "admin@acme.com",
      "firstName": "John",
      "lastName": "Doe",
      "tenantId": "cmge1zgeb0000vdcgu6ncw6h8",
      "createdAt": "2025-10-05T18:46:27.815Z",
      "updatedAt": "2025-10-05T18:46:27.815Z"
    }
  }
}

{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWdlMXpnZmEwMDEwdmRjZ2dyemcwNjB0IiwidGVuYW50SWQiOiJjbWdlMXpnZWIwMDAwdmRjZ3U2bmN3Nmg4Iiwicm9sZXMiOlsiY21nZTF6Z2V3MDAwd3ZkY2dlczN3a3luciJdLCJpYXQiOjE3NTk2OTAxMTYsImV4cCI6MTc1OTY5MTAxNn0.21RoeTnoHss3HjMzdjxQtCfXj0xTv0K8IASi9S7y1H8"
}
 */
