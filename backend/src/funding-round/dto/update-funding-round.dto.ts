import {
  IsString,
  IsOptional,
  MaxLength,
  Matches,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFundingRoundDto {
  @ApiPropertyOptional({ description: 'Round name', example: 'Seed Round - Extended' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    description: 'Target amount to raise (Decimal as string)',
    example: '6000000.00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'targetAmount must be a positive decimal number',
  })
  targetAmount?: string;

  @ApiPropertyOptional({
    description: 'Minimum amount to close (Decimal as string)',
    example: '2500000.00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'minimumCloseAmount must be a positive decimal number',
  })
  minimumCloseAmount?: string;

  @ApiPropertyOptional({
    description: 'Hard cap — maximum amount (Decimal as string)',
    example: '8000000.00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'hardCap must be a positive decimal number',
  })
  hardCap?: string;

  @ApiPropertyOptional({
    description: 'Pre-money valuation (Decimal as string)',
    example: '25000000.00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'preMoneyValuation must be a positive decimal number',
  })
  preMoneyValuation?: string;

  @ApiPropertyOptional({
    description: 'Price per share (Decimal as string)',
    example: '12.00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'pricePerShare must be a positive decimal number',
  })
  pricePerShare?: string;

  @ApiPropertyOptional({
    description: 'Target close date (ISO 8601)',
    example: '2026-09-30',
  })
  @IsOptional()
  @IsDateString()
  targetCloseDate?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Extended deadline',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
