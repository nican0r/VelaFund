import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const VALID_STATUSES = [
  'DRAFT',
  'GENERATED',
  'PENDING_SIGNATURES',
  'PARTIALLY_SIGNED',
  'FULLY_SIGNED',
];

const VALID_TYPES = [
  'SHAREHOLDER_AGREEMENT',
  'MEETING_MINUTES',
  'SHARE_CERTIFICATE',
  'OPTION_LETTER',
  'INVESTMENT_AGREEMENT',
];

export class ListDocumentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by document status' })
  @IsOptional()
  @IsString()
  @IsIn(VALID_STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by document type (via template)' })
  @IsOptional()
  @IsString()
  @IsIn(VALID_TYPES)
  type?: string;

  @ApiPropertyOptional({ description: 'Search by document title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Sort field (prefix - for desc)', default: '-createdAt' })
  @IsOptional()
  @IsString()
  sort?: string;
}
