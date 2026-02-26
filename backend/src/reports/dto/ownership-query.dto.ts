import { IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class OwnershipQueryDto {
  @IsOptional()
  @IsUUID()
  shareClassId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeOptions?: boolean = true;
}
