import { IsString, IsNotEmpty, IsUUID, IsOptional, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConvertConvertibleDto {
  @ApiProperty({
    description: 'Funding round UUID that triggers the conversion',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  fundingRoundId: string;

  @ApiProperty({
    description: 'Pre-money valuation of the round (Decimal as string)',
    example: '10000000.00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'roundValuation must be a positive decimal number',
  })
  roundValuation: string;

  @ApiProperty({
    description: 'Share class UUID for converted shares',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  shareClassId: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Series A conversion',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
