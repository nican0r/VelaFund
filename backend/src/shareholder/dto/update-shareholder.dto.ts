import {
  IsString,
  IsOptional,
  IsEmail,
  IsObject,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AddressDto } from './create-shareholder.dto';

/**
 * Update DTO for shareholders.
 *
 * Immutable fields (not updatable): name, cpfCnpj, type, walletAddress.
 * Mutable fields: email, phone, address, taxResidency, rdeIedNumber, rdeIedDate.
 */
export class UpdateShareholderDto {
  @ApiPropertyOptional({ description: 'Contact email' })
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
    description: 'ISO country code for tax residency',
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
