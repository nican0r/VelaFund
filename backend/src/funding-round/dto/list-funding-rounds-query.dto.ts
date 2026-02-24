import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum FundingRoundStatusFilterDto {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export class ListFundingRoundsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by round status',
    enum: FundingRoundStatusFilterDto,
  })
  @IsOptional()
  @IsEnum(FundingRoundStatusFilterDto)
  status?: FundingRoundStatusFilterDto;

  @ApiPropertyOptional({
    description: 'Sort field. Prefix with - for descending. Default: -createdAt',
    example: '-createdAt',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}

export enum CommitmentPaymentStatusFilterDto {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export class ListCommitmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by payment status',
    enum: CommitmentPaymentStatusFilterDto,
  })
  @IsOptional()
  @IsEnum(CommitmentPaymentStatusFilterDto)
  paymentStatus?: CommitmentPaymentStatusFilterDto;

  @ApiPropertyOptional({
    description: 'Sort field. Prefix with - for descending. Default: -createdAt',
    example: '-createdAt',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
