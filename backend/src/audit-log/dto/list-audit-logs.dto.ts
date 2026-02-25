import { IsOptional, IsString, IsUUID, IsDateString, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListAuditLogsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by action type (e.g., SHAREHOLDER_CREATED)' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by actor UUID' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ description: 'Filter by resource type (e.g., Shareholder)' })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ description: 'Filter by specific resource UUID' })
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @ApiPropertyOptional({ description: 'Logs after this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  @Type(() => String)
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Logs before this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  @Type(() => String)
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Sort field(s). Prefix with - for descending. Default: -timestamp',
    example: '-timestamp',
  })
  @IsOptional()
  @IsString()
  @Matches(/^-?[a-zA-Z]+(,-?[a-zA-Z]+){0,2}$/, {
    message: 'Invalid sort format. Use: field, -field, or comma-separated.',
  })
  sort?: string;
}
