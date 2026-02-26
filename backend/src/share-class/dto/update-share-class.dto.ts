import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  Matches,
  IsNumber,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShareClassTypeDto } from './create-share-class.dto';

export class UpdateShareClassDto {
  // ─── Fields mutable ONLY before shares are issued (totalIssued = 0) ───

  @ApiPropertyOptional({
    description: 'Share class name (immutable after shares are issued)',
    example: 'Ações Ordinárias',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  className?: string;

  @ApiPropertyOptional({
    description: 'Share class type (immutable after shares are issued)',
    enum: ShareClassTypeDto,
  })
  @IsOptional()
  @IsEnum(ShareClassTypeDto)
  type?: ShareClassTypeDto;

  @ApiPropertyOptional({
    description: 'Votes per share (immutable after shares are issued; 0 for non-voting preferred)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  votesPerShare?: number;

  @ApiPropertyOptional({
    description: 'Liquidation preference multiple (immutable after shares are issued; >= 1.0)',
    example: 1.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(1.0)
  liquidationPreferenceMultiple?: number | null;

  @ApiPropertyOptional({
    description:
      'Whether preferred shares participate in remaining proceeds (immutable after shares are issued)',
  })
  @IsOptional()
  @IsBoolean()
  participatingRights?: boolean;

  // ─── Fields always mutable ────────────────────────────────────────────

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
