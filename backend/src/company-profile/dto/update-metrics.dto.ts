import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MetricFormat } from '@prisma/client';

export class MetricItemDto {
  @IsString()
  @MaxLength(50)
  label: string;

  @IsString()
  @MaxLength(100)
  value: string;

  @IsEnum(MetricFormat)
  format: MetricFormat;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @Type(() => Number)
  @IsInt()
  order: number;
}

export class UpdateMetricsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(6)
  @Type(() => MetricItemDto)
  metrics: MetricItemDto[];
}
