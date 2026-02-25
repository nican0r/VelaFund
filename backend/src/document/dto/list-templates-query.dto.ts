import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const VALID_TYPES = [
  'SHAREHOLDER_AGREEMENT',
  'MEETING_MINUTES',
  'SHARE_CERTIFICATE',
  'OPTION_LETTER',
  'INVESTMENT_AGREEMENT',
];

export class ListTemplatesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by document type' })
  @IsOptional()
  @IsString()
  @IsIn(VALID_TYPES)
  type?: string;

  @ApiPropertyOptional({ description: 'Search by template name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Sort field (prefix - for desc)', default: '-createdAt' })
  @IsOptional()
  @IsString()
  sort?: string;
}
