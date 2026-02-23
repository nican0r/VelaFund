import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Brazilian CNPJ format: XX.XXX.XXX/XXXX-XX
const CNPJ_REGEX = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

export enum CompanyEntityTypeDto {
  LTDA = 'LTDA',
  SA_CAPITAL_FECHADO = 'SA_CAPITAL_FECHADO',
  SA_CAPITAL_ABERTO = 'SA_CAPITAL_ABERTO',
}

export class CreateCompanyDto {
  @ApiProperty({ description: 'Company legal name', example: 'Acme Tecnologia Ltda.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description: 'Brazilian legal entity type',
    enum: CompanyEntityTypeDto,
    example: 'LTDA',
  })
  @IsEnum(CompanyEntityTypeDto)
  entityType: CompanyEntityTypeDto;

  @ApiProperty({
    description: 'Company CNPJ in XX.XXX.XXX/XXXX-XX format',
    example: '12.345.678/0001-90',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(CNPJ_REGEX, { message: 'CNPJ must be in XX.XXX.XXX/XXXX-XX format' })
  cnpj: string;

  @ApiPropertyOptional({ description: 'Company description', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Company founding date (ISO 8601)',
    example: '2022-03-15',
  })
  @IsOptional()
  @IsString()
  foundedDate?: string;

  @ApiPropertyOptional({ description: 'Default currency', default: 'BRL' })
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @ApiPropertyOptional({
    description: 'Fiscal year end (MM-DD format)',
    default: '12-31',
    example: '12-31',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}-\d{2}$/, { message: 'Fiscal year end must be in MM-DD format' })
  fiscalYearEnd?: string;

  @ApiPropertyOptional({ description: 'Timezone', default: 'America/Sao_Paulo' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Locale', default: 'pt-BR' })
  @IsOptional()
  @IsString()
  locale?: string;
}
