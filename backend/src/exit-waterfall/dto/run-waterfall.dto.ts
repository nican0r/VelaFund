import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
  IsBoolean,
  Matches,
} from 'class-validator';

export class RunWaterfallDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'exitAmount must be a valid decimal string with up to 2 decimal places',
  })
  exitAmount: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  shareClassOrder?: string[];

  @IsOptional()
  @IsBoolean()
  includeOptions?: boolean;

  @IsOptional()
  @IsBoolean()
  includeConvertibles?: boolean;
}
