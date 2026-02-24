import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
  MaxLength,
  Matches,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum InstrumentTypeDto {
  MUTUO_CONVERSIVEL = 'MUTUO_CONVERSIVEL',
  INVESTIMENTO_ANJO = 'INVESTIMENTO_ANJO',
  MISTO = 'MISTO',
  MAIS = 'MAIS',
}

export enum InterestTypeDto {
  SIMPLE = 'SIMPLE',
  COMPOUND = 'COMPOUND',
}

export enum ConversionTriggerDto {
  QUALIFIED_FINANCING = 'QUALIFIED_FINANCING',
  MATURITY = 'MATURITY',
  CHANGE_OF_CONTROL = 'CHANGE_OF_CONTROL',
  INVESTOR_OPTION = 'INVESTOR_OPTION',
}

export class CreateConvertibleDto {
  @ApiProperty({
    description: 'Shareholder (investor) UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  shareholderId: string;

  @ApiProperty({
    description: 'Instrument type',
    enum: InstrumentTypeDto,
    example: 'MUTUO_CONVERSIVEL',
  })
  @IsEnum(InstrumentTypeDto)
  instrumentType: InstrumentTypeDto;

  @ApiProperty({
    description: 'Principal amount (Decimal as string)',
    example: '100000.00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'principalAmount must be a positive decimal number',
  })
  principalAmount: string;

  @ApiProperty({
    description: 'Annual interest rate as decimal (e.g. 0.08 for 8%)',
    example: '0.08',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'interestRate must be a positive decimal number',
  })
  interestRate: string;

  @ApiPropertyOptional({
    description: 'Interest type',
    enum: InterestTypeDto,
    example: 'SIMPLE',
    default: 'SIMPLE',
  })
  @IsOptional()
  @IsEnum(InterestTypeDto)
  interestType?: InterestTypeDto;

  @ApiPropertyOptional({
    description: 'Discount rate for conversion (e.g. 0.20 for 20%)',
    example: '0.20',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'discountRate must be a positive decimal number',
  })
  discountRate?: string;

  @ApiPropertyOptional({
    description: 'Valuation cap for conversion (Decimal as string)',
    example: '5000000.00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'valuationCap must be a positive decimal number',
  })
  valuationCap?: string;

  @ApiPropertyOptional({
    description: 'Qualified financing threshold (Decimal as string)',
    example: '500000.00',
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
    example: 'QUALIFIED_FINANCING',
  })
  @IsOptional()
  @IsEnum(ConversionTriggerDto)
  conversionTrigger?: ConversionTriggerDto;

  @ApiPropertyOptional({
    description: 'Target share class UUID for conversion',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  targetShareClassId?: string;

  @ApiPropertyOptional({
    description: 'Auto-convert on qualified financing',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoConvert?: boolean;

  @ApiPropertyOptional({
    description: 'Most Favored Nation clause enabled',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  mfnClause?: boolean;

  @ApiProperty({
    description: 'Issue date (ISO 8601)',
    example: '2024-01-15',
  })
  @IsDateString()
  issueDate: string;

  @ApiProperty({
    description: 'Maturity date (ISO 8601)',
    example: '2026-01-15',
  })
  @IsDateString()
  maturityDate: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Mútuo conversível padrão',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
