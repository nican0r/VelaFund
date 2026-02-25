import { IsEnum, IsString, IsNotEmpty } from 'class-validator';

export enum DocumentTypeDto {
  RG = 'RG',
  CNH = 'CNH',
  RNE = 'RNE',
  PASSPORT = 'PASSPORT',
}

export class UploadDocumentDto {
  @IsEnum(DocumentTypeDto)
  documentType: DocumentTypeDto;

  @IsString()
  @IsNotEmpty()
  documentNumber: string;
}
