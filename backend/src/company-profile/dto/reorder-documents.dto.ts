import { IsArray, ValidateNested, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class DocumentOrderItem {
  @IsString()
  id: string;

  @IsInt()
  @Min(0)
  order: number;
}

export class ReorderDocumentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentOrderItem)
  documents: DocumentOrderItem[];
}
