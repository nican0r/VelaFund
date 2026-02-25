import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DocumentCategory } from '@prisma/client';

export class UploadDocumentDto {
  @IsEnum(DocumentCategory)
  category: DocumentCategory;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}
