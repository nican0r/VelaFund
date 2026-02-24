import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum TransactionTypeFilterDto {
  ISSUANCE = 'ISSUANCE',
  TRANSFER = 'TRANSFER',
  CONVERSION = 'CONVERSION',
  CANCELLATION = 'CANCELLATION',
  SPLIT = 'SPLIT',
}

export enum TransactionStatusFilterDto {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export class ListTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by transaction type',
    enum: TransactionTypeFilterDto,
  })
  @IsOptional()
  @IsEnum(TransactionTypeFilterDto)
  type?: TransactionTypeFilterDto;

  @ApiPropertyOptional({
    description: 'Filter by transaction status',
    enum: TransactionStatusFilterDto,
  })
  @IsOptional()
  @IsEnum(TransactionStatusFilterDto)
  status?: TransactionStatusFilterDto;

  @ApiPropertyOptional({
    description: 'Filter by shareholder UUID (matches from or to)',
  })
  @IsOptional()
  @IsUUID()
  shareholderId?: string;

  @ApiPropertyOptional({
    description: 'Filter by share class UUID',
  })
  @IsOptional()
  @IsUUID()
  shareClassId?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions created after this date (ISO 8601)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsString()
  createdAfter?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions created before this date (ISO 8601)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsString()
  createdBefore?: string;

  @ApiPropertyOptional({
    description: 'Sort field. Prefix with - for descending. Default: -createdAt',
    example: '-createdAt',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
