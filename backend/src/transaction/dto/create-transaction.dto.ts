import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TransactionTypeDto {
  ISSUANCE = 'ISSUANCE',
  TRANSFER = 'TRANSFER',
  CONVERSION = 'CONVERSION',
  CANCELLATION = 'CANCELLATION',
  SPLIT = 'SPLIT',
}

export class CreateTransactionDto {
  @ApiProperty({
    description: 'Transaction type',
    enum: TransactionTypeDto,
    example: 'ISSUANCE',
  })
  @IsEnum(TransactionTypeDto)
  type: TransactionTypeDto;

  @ApiPropertyOptional({
    description: 'Source shareholder UUID (required for TRANSFER, CONVERSION, CANCELLATION)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  fromShareholderId?: string;

  @ApiPropertyOptional({
    description: 'Destination shareholder UUID (required for ISSUANCE, TRANSFER)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  toShareholderId?: string;

  @ApiProperty({
    description: 'Share class UUID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  shareClassId: string;

  @ApiProperty({
    description: 'Number of shares (Decimal as string)',
    example: '10000',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'quantity must be a positive decimal number',
  })
  quantity: string;

  @ApiPropertyOptional({
    description: 'Price per share (Decimal as string)',
    example: '1.50',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'pricePerShare must be a positive decimal number',
  })
  pricePerShare?: string;

  @ApiPropertyOptional({
    description: 'Notes or description for the transaction',
    example: 'Series A issuance',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Whether this transaction requires board approval',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresBoardApproval?: boolean;

  @ApiPropertyOptional({
    description:
      'Target share class UUID for CONVERSION type (convert from shareClassId to toShareClassId)',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsUUID()
  toShareClassId?: string;

  @ApiPropertyOptional({
    description: 'Split ratio as string (e.g. "2" for 2:1 split)',
    example: '2',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'splitRatio must be a positive decimal number',
  })
  splitRatio?: string;
}
