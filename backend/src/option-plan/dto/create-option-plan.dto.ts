import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TerminationPolicy, VestingFrequency } from '@prisma/client';

export class CreateOptionPlanDto {
  @ApiProperty({ description: 'Plan name', example: '2026 Employee Option Plan' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ description: 'Share class UUID for this plan' })
  @IsNotEmpty()
  @IsUUID()
  shareClassId: string;

  @ApiProperty({
    description: 'Total pool size (number of options)',
    example: '150000',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'totalPoolSize must be a numeric string' })
  totalPoolSize: string;

  @ApiPropertyOptional({ description: 'Board approval date', example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  boardApprovalDate?: string;

  @ApiPropertyOptional({
    description: 'Termination policy',
    enum: TerminationPolicy,
    default: 'FORFEITURE',
  })
  @IsOptional()
  @IsEnum(TerminationPolicy)
  terminationPolicy?: TerminationPolicy;

  @ApiPropertyOptional({
    description: 'Exercise window in days after termination',
    example: 90,
    default: 90,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  exerciseWindowDays?: number;

  @ApiPropertyOptional({
    description: 'Default cliff months for grants',
    example: 12,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  defaultCliffMonths?: number;

  @ApiPropertyOptional({
    description: 'Default vesting duration in months for grants',
    example: 48,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  defaultVestingMonths?: number;

  @ApiPropertyOptional({
    description: 'Default vesting frequency for grants',
    enum: VestingFrequency,
    default: 'MONTHLY',
  })
  @IsOptional()
  @IsEnum(VestingFrequency)
  defaultVestingFrequency?: VestingFrequency;

  @ApiPropertyOptional({ description: 'Optional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
