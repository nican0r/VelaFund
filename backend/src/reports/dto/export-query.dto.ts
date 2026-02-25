import { IsOptional, IsIn, IsDateString } from 'class-validator';

export class ExportQueryDto {
  @IsOptional()
  @IsIn(['pdf', 'xlsx', 'csv', 'oct'])
  format?: string = 'pdf';

  @IsOptional()
  @IsDateString()
  snapshotDate?: string;
}
