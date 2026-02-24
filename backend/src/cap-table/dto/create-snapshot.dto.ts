import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSnapshotDto {
  @IsDateString()
  snapshotDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
