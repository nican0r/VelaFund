import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { IsOptional, IsString } from 'class-validator';

export class SnapshotHistoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  sort?: string;
}
