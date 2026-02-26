import { IsOptional, IsString, IsEnum, IsInt, IsUrl, MaxLength, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { CompanySector, ProfileAccessType } from '@prisma/client';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(CompanySector)
  sector?: CompanySector;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  foundedYear?: number;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @IsEnum(ProfileAccessType)
  accessType?: ProfileAccessType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  accessPassword?: string;
}
