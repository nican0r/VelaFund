import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum ConvertibleStatusFilterDto {
  OUTSTANDING = 'OUTSTANDING',
  CONVERTED = 'CONVERTED',
  REDEEMED = 'REDEEMED',
  MATURED = 'MATURED',
  CANCELLED = 'CANCELLED',
}

export class ListConvertiblesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ConvertibleStatusFilterDto,
  })
  @IsOptional()
  @IsEnum(ConvertibleStatusFilterDto)
  status?: ConvertibleStatusFilterDto;

  @ApiPropertyOptional({
    description: 'Filter by shareholder UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  shareholderId?: string;

  @ApiPropertyOptional({
    description: 'Sort field. Prefix with - for descending. Default: -createdAt',
    example: '-createdAt',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
