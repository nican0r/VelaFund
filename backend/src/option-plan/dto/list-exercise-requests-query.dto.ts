import { IsOptional, IsString, IsIn } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListExerciseRequestsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'SHARES_ISSUED', 'COMPLETED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  grantId?: string;

  @IsOptional()
  @IsString()
  sort?: string;
}
