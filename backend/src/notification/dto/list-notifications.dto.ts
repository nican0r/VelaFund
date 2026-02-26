import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListNotificationsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by read status', enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  @IsIn(['true', 'false'])
  read?: string;

  @ApiPropertyOptional({ description: 'Filter by notification type' })
  @IsOptional()
  @IsString()
  notificationType?: string;

  @ApiPropertyOptional({
    description: 'Sort field (prefix with - for descending)',
    default: '-createdAt',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
