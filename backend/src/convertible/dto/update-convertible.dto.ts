import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
  MaxLength,
  Matches,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ConversionTriggerDto, InterestTypeDto } from './create-convertible.dto';

export class UpdateConvertibleDto {
  @ApiPropertyOptional({
    description: 'Discount rate for conversion (e.g. 0.25 for 25%)',
    example: '0.25',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'discountRate must be a positive decimal number',
  })
  discountRate?: string;

  @ApiPropertyOptional({
    description: 'Valuation cap for conversion (Decimal as string)',
    example: '6000000.00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'valuationCap must be a positive decimal number',
  })
  valuationCap?: string;

  @ApiPropertyOptional({
    description: 'Updated maturity date (ISO 8601)',
    example: '2027-01-15',
  })
  @IsOptional()
  @IsDateString()
  maturityDate?: string;

  @ApiPropertyOptional({
    description: 'Qualified financing threshold (Decimal as string)',
    example: '750000.00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'qualifiedFinancingThreshold must be a positive decimal number',
  })
  qualifiedFinancingThreshold?: string;

  @ApiPropertyOptional({
    description: 'Conversion trigger type',
    enum: ConversionTriggerDto,
  })
  @IsOptional()
  @IsEnum(ConversionTriggerDto)
  conversionTrigger?: ConversionTriggerDto;

  @ApiPropertyOptional({
    description: 'Target share class UUID for conversion',
  })
  @IsOptional()
  @IsUUID()
  targetShareClassId?: string;

  @ApiPropertyOptional({
    description: 'Auto-convert on qualified financing',
  })
  @IsOptional()
  @IsBoolean()
  autoConvert?: boolean;

  @ApiPropertyOptional({
    description: 'Most Favored Nation clause enabled',
  })
  @IsOptional()
  @IsBoolean()
  mfnClause?: boolean;

  @ApiPropertyOptional({
    description: 'Interest type (only updatable while OUTSTANDING)',
    enum: InterestTypeDto,
  })
  @IsOptional()
  @IsEnum(InterestTypeDto)
  interestType?: InterestTypeDto;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Updated terms',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
