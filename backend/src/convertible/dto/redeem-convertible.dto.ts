import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RedeemConvertibleDto {
  @ApiProperty({
    description: 'Redemption amount (Decimal as string)',
    example: '108000.00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'redemptionAmount must be a positive decimal number',
  })
  redemptionAmount: string;

  @ApiPropertyOptional({
    description: 'Payment reference / wire transfer confirmation',
    example: 'Wire transfer confirmation #12345',
  })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the redemption',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
