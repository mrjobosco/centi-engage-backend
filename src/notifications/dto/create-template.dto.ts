import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsObject,
} from 'class-validator';
import { NotificationChannelType } from '../enums';

export class CreateTemplateDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsString()
  category!: string;

  @IsEnum(NotificationChannelType)
  channel!: NotificationChannelType;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  templateBody!: string;

  @IsObject()
  variables!: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
