import { IsOptional, IsEnum, IsString, IsBooleanString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ShareholderTypeDto } from './create-shareholder.dto';

export enum ShareholderStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
}

export class ListShareholdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by shareholder status',
    enum: ShareholderStatusDto,
  })
  @IsOptional()
  @IsEnum(ShareholderStatusDto)
  status?: ShareholderStatusDto;

  @ApiPropertyOptional({
    description: 'Filter by shareholder type',
    enum: ShareholderTypeDto,
  })
  @IsOptional()
  @IsEnum(ShareholderTypeDto)
  type?: ShareholderTypeDto;

  @ApiPropertyOptional({
    description: 'Filter by foreign shareholder flag',
  })
  @IsOptional()
  @IsBooleanString()
  isForeign?: string;

  @ApiPropertyOptional({
    description: 'Search by name or email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort fields (e.g., "-createdAt", "name", "-type")',
    default: '-createdAt',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
