import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
  IsBoolean,
  IsObject,
  MaxLength,
  Matches,
} from 'class-validator';

export class SaveScenarioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'exitAmount must be a valid decimal string with up to 2 decimal places',
  })
  exitAmount: string;

  @IsOptional()
  @IsBoolean()
  includeOptions?: boolean;

  @IsOptional()
  @IsBoolean()
  includeConvertibles?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  shareClassOrder?: string[];

  @IsObject()
  resultData: Record<string, unknown>;
}
