import { IsOptional, IsDateString, IsIn } from 'class-validator';

export class DilutionQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  granularity?: string = 'month';
}
