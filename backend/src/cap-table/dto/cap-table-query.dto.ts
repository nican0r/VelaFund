import { IsOptional, IsString, IsIn } from 'class-validator';

export class CapTableQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['current', 'fully-diluted', 'authorized'])
  view?: string = 'current';

  @IsOptional()
  @IsString()
  shareClassId?: string;
}
