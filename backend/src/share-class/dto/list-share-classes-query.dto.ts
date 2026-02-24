import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ShareClassTypeDto } from './create-share-class.dto';

export class ListShareClassesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by share class type',
    enum: ShareClassTypeDto,
  })
  @IsOptional()
  @IsEnum(ShareClassTypeDto)
  type?: ShareClassTypeDto;

  @ApiPropertyOptional({
    description: 'Sort order (e.g., -createdAt, className)',
    default: '-createdAt',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
