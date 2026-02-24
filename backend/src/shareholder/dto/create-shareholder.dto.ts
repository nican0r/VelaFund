import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsEmail,
  IsObject,
  MaxLength,
  MinLength,
  Matches,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ShareholderTypeDto {
  FOUNDER = 'FOUNDER',
  INVESTOR = 'INVESTOR',
  EMPLOYEE = 'EMPLOYEE',
  ADVISOR = 'ADVISOR',
  CORPORATE = 'CORPORATE',
}

export class AddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;
}

/**
 * CPF format: XXX.XXX.XXX-XX (11 digits)
 * CNPJ format: XX.XXX.XXX/XXXX-XX (14 digits)
 */
const CPF_REGEX = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const CNPJ_REGEX = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

export class CreateShareholderDto {
  @ApiProperty({
    description: 'Full legal name of the shareholder',
    example: 'João Silva',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(300)
  name: string;

  @ApiProperty({
    description: 'Shareholder type',
    enum: ShareholderTypeDto,
    example: 'FOUNDER',
  })
  @IsEnum(ShareholderTypeDto)
  type: ShareholderTypeDto;

  @ApiPropertyOptional({
    description: 'CPF (XXX.XXX.XXX-XX) or CNPJ (XX.XXX.XXX/XXXX-XX)',
    example: '123.456.789-09',
  })
  @IsOptional()
  @IsString()
  cpfCnpj?: string;

  @ApiPropertyOptional({
    description: 'Contact email',
    example: 'joao@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ description: 'Physical address' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiPropertyOptional({
    description: 'ISO country code for nationality',
    default: 'BR',
    example: 'BR',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'nationality must be a 2-letter ISO country code' })
  nationality?: string;

  @ApiPropertyOptional({
    description: 'ISO country code for tax residency',
    default: 'BR',
    example: 'BR',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'taxResidency must be a 2-letter ISO country code' })
  taxResidency?: string;

  @ApiPropertyOptional({
    description: 'Foreign investment registration number (RDE-IED)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  rdeIedNumber?: string;

  @ApiPropertyOptional({
    description: 'RDE-IED registration date (ISO 8601)',
    example: '2026-01-15',
  })
  @IsOptional()
  @IsString()
  rdeIedDate?: string;
}
