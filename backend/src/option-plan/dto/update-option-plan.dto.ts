import {
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TerminationPolicy, VestingFrequency } from '@prisma/client';

export class UpdateOptionPlanDto {
  @ApiPropertyOptional({ description: 'Plan name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    description: 'Total pool size (can only increase)',
    example: '200000',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'totalPoolSize must be a numeric string' })
  totalPoolSize?: string;

  @ApiPropertyOptional({ description: 'Board approval date' })
  @IsOptional()
  @IsDateString()
  boardApprovalDate?: string;

  @ApiPropertyOptional({
    description: 'Termination policy',
    enum: TerminationPolicy,
  })
  @IsOptional()
  @IsEnum(TerminationPolicy)
  terminationPolicy?: TerminationPolicy;

  @ApiPropertyOptional({
    description: 'Exercise window in days after termination',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  exerciseWindowDays?: number;

  @ApiPropertyOptional({
    description: 'Default cliff months for grants',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  defaultCliffMonths?: number;

  @ApiPropertyOptional({
    description: 'Default vesting duration in months',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  defaultVestingMonths?: number;

  @ApiPropertyOptional({
    description: 'Default vesting frequency',
    enum: VestingFrequency,
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
