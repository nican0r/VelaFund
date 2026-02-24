import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  Matches,
  IsNumber,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateShareClassDto {
  @ApiPropertyOptional({
    description: 'Total authorized shares (can only increase; must be >= totalIssued)',
    example: '2000000',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'totalAuthorized must be a valid decimal number string',
  })
  totalAuthorized?: string;

  @ApiPropertyOptional({
    description: 'Lock-up period in months (null = remove lock-up)',
    example: 12,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  lockUpPeriodMonths?: number | null;

  @ApiPropertyOptional({
    description: 'Tag-along percentage (0-100, null = remove tag-along)',
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tagAlongPercentage?: number | null;

  @ApiPropertyOptional({
    description: 'Right of first refusal on share transfers',
  })
  @IsOptional()
  @IsBoolean()
  rightOfFirstRefusal?: boolean;
}
