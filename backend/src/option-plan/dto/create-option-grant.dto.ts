import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VestingFrequency } from '@prisma/client';

export class CreateOptionGrantDto {
  @ApiProperty({ description: 'Option plan UUID' })
  @IsNotEmpty()
  @IsUUID()
  optionPlanId: string;

  @ApiPropertyOptional({ description: 'Shareholder UUID (optional, may not yet be a shareholder)' })
  @IsOptional()
  @IsUUID()
  shareholderId?: string;

  @ApiProperty({ description: 'Employee name', example: 'Maria Silva' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  employeeName: string;

  @ApiProperty({ description: 'Employee email', example: 'maria@company.com' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  employeeEmail: string;

  @ApiProperty({ description: 'Number of options to grant', example: '10000' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'quantity must be a numeric string' })
  quantity: string;

  @ApiProperty({ description: 'Strike price per option', example: '5.00' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'strikePrice must be a numeric string' })
  strikePrice: string;

  @ApiProperty({ description: 'Grant date', example: '2026-01-15' })
  @IsNotEmpty()
  @IsDateString()
  grantDate: string;

  @ApiProperty({ description: 'Expiration date', example: '2036-01-15' })
  @IsNotEmpty()
  @IsDateString()
  expirationDate: string;

  @ApiProperty({ description: 'Cliff period in months', example: 12 })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Max(60)
  cliffMonths: number;

  @ApiProperty({ description: 'Total vesting duration in months', example: 48 })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(120)
  vestingDurationMonths: number;

  @ApiPropertyOptional({
    description: 'Vesting frequency',
    enum: VestingFrequency,
    default: 'MONTHLY',
  })
  @IsOptional()
  @IsEnum(VestingFrequency)
  vestingFrequency?: VestingFrequency;

  @ApiPropertyOptional({
    description: 'Acceleration on change of control',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  accelerationOnCoc?: boolean;

  @ApiPropertyOptional({ description: 'Optional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
