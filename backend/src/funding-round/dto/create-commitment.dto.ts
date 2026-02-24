import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommitmentDto {
  @ApiProperty({
    description: 'Shareholder UUID (investor)',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @IsUUID()
  shareholderId: string;

  @ApiProperty({
    description: 'Committed amount (Decimal as string)',
    example: '500000.00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'committedAmount must be a positive decimal number',
  })
  committedAmount: string;

  @ApiPropertyOptional({
    description: 'Whether this commitment has a side letter',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  hasSideLetter?: boolean;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Lead investor commitment',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
