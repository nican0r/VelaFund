import { IsOptional, IsDateString } from 'class-validator';

export class DueDiligenceQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
