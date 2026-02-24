import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
  Matches,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ShareClassTypeDto {
  QUOTA = 'QUOTA',
  COMMON_SHARES = 'COMMON_SHARES',
  PREFERRED_SHARES = 'PREFERRED_SHARES',
}

export class CreateShareClassDto {
  @ApiProperty({
    description: 'Share class name (unique per company)',
    example: 'Quotas Ordinarias',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  className: string;

  @ApiProperty({
    description: 'Share class type',
    enum: ShareClassTypeDto,
    example: 'COMMON_SHARES',
  })
  @IsEnum(ShareClassTypeDto)
  type: ShareClassTypeDto;

  @ApiProperty({
    description: 'Total authorized shares (decimal as string)',
    example: '1000000',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'totalAuthorized must be a valid decimal number string',
  })
  totalAuthorized: string;

  @ApiProperty({
    description: 'Votes per share (0 for non-voting preferred)',
    example: 1,
  })
  @IsInt()
  @Min(0)
  votesPerShare: number;

  @ApiPropertyOptional({
    description: 'Liquidation preference multiple (>= 1.0)',
    example: 1.0,
    default: 1.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(1.0)
  liquidationPreferenceMultiple?: number;

  @ApiPropertyOptional({
    description: 'Whether preferred shares participate in remaining proceeds',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  participatingRights?: boolean;

  @ApiPropertyOptional({
    description: 'Right of first refusal on share transfers',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  rightOfFirstRefusal?: boolean;

  @ApiPropertyOptional({
    description: 'Lock-up period in months (null = no lock-up)',
    example: 12,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  lockUpPeriodMonths?: number | null;

  @ApiPropertyOptional({
    description: 'Tag-along percentage (0-100, null = no tag-along)',
    example: 80,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tagAlongPercentage?: number | null;
}
