import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum OptionPlanStatusFilterDto {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

export enum OptionGrantStatusFilterDto {
  ACTIVE = 'ACTIVE',
  EXERCISED = 'EXERCISED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export class ListOptionPlansQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: OptionPlanStatusFilterDto,
  })
  @IsOptional()
  @IsEnum(OptionPlanStatusFilterDto)
  status?: OptionPlanStatusFilterDto;

  @ApiPropertyOptional({
    description: 'Sort field. Prefix with - for descending. Default: -createdAt',
    example: '-createdAt',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}

export class ListOptionGrantsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: OptionGrantStatusFilterDto,
  })
  @IsOptional()
  @IsEnum(OptionGrantStatusFilterDto)
  status?: OptionGrantStatusFilterDto;

  @ApiPropertyOptional({ description: 'Filter by option plan UUID' })
  @IsOptional()
  @IsUUID()
  optionPlanId?: string;

  @ApiPropertyOptional({ description: 'Filter by shareholder UUID' })
  @IsOptional()
  @IsUUID()
  shareholderId?: string;

  @ApiPropertyOptional({
    description: 'Sort field. Prefix with - for descending. Default: -grantDate',
    example: '-grantDate',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
