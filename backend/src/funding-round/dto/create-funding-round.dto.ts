import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
  Matches,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RoundTypeDto {
  SEED = 'SEED',
  SERIES_A = 'SERIES_A',
  SERIES_B = 'SERIES_B',
  SERIES_C = 'SERIES_C',
  BRIDGE = 'BRIDGE',
}

export class CreateFundingRoundDto {
  @ApiProperty({ description: 'Round name', example: 'Seed Round' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description: 'Round type',
    enum: RoundTypeDto,
    example: 'SEED',
  })
  @IsEnum(RoundTypeDto)
  roundType: RoundTypeDto;

  @ApiProperty({
    description: 'Share class UUID for issued shares',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  shareClassId: string;

  @ApiProperty({
    description: 'Target amount to raise (Decimal as string)',
    example: '5000000.00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'targetAmount must be a positive decimal number',
  })
  targetAmount: string;

  @ApiPropertyOptional({
    description: 'Minimum amount to close (Decimal as string)',
    example: '2000000.00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'minimumCloseAmount must be a positive decimal number',
  })
  minimumCloseAmount?: string;

  @ApiPropertyOptional({
    description: 'Hard cap — maximum amount (Decimal as string)',
    example: '7000000.00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'hardCap must be a positive decimal number',
  })
  hardCap?: string;

  @ApiProperty({
    description: 'Pre-money valuation (Decimal as string)',
    example: '20000000.00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'preMoneyValuation must be a positive decimal number',
  })
  preMoneyValuation: string;

  @ApiProperty({
    description: 'Price per share (Decimal as string)',
    example: '10.00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'pricePerShare must be a positive decimal number',
  })
  pricePerShare: string;

  @ApiPropertyOptional({
    description: 'Target close date (ISO 8601)',
    example: '2026-06-30',
  })
  @IsOptional()
  @IsDateString()
  targetCloseDate?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'First institutional round',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
