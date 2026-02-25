import { IsString, IsUUID, IsOptional, IsObject, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDocumentDto {
  @ApiProperty({ description: 'Template ID to generate from' })
  @IsUUID()
  templateId: string;

  @ApiProperty({ description: 'Document title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Document locale', default: 'pt-BR' })
  @IsOptional()
  @IsString()
  @IsIn(['pt-BR', 'en'])
  locale?: string = 'pt-BR';

  @ApiProperty({ description: 'Form data matching template schema' })
  @IsObject()
  formData: Record<string, unknown>;
}
