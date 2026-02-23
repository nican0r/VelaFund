import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
  IsUrl,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCompanyDto {
  @ApiPropertyOptional({ description: 'Company legal name', minLength: 2, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Company description', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Company logo URL (S3)' })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'Logo URL must be a valid URL' })
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Default currency', default: 'BRL' })
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @ApiPropertyOptional({
    description: 'Fiscal year end (MM-DD format)',
    example: '12-31',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}-\d{2}$/, { message: 'Fiscal year end must be in MM-DD format' })
  fiscalYearEnd?: string;

  @ApiPropertyOptional({ description: 'Timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Locale' })
  @IsOptional()
  @IsString()
  locale?: string;
}
