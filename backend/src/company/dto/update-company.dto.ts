import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
  IsUrl,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Brazilian CNPJ format: XX.XXX.XXX/XXXX-XX
const CNPJ_REGEX = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

export class UpdateCompanyDto {
  @ApiPropertyOptional({ description: 'Company legal name', minLength: 2, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    description: 'Company CNPJ (only editable in DRAFT status)',
    example: '12.345.678/0001-90',
  })
  @IsOptional()
  @IsString()
  @Matches(CNPJ_REGEX, { message: 'CNPJ must be in XX.XXX.XXX/XXXX-XX format' })
  cnpj?: string;

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
