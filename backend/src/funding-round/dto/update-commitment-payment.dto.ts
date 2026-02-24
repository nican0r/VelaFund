import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentStatusUpdateDto {
  RECEIVED = 'RECEIVED',
  CONFIRMED = 'CONFIRMED',
}

export class UpdateCommitmentPaymentDto {
  @ApiProperty({
    description: 'New payment status',
    enum: PaymentStatusUpdateDto,
  })
  @IsEnum(PaymentStatusUpdateDto)
  paymentStatus: PaymentStatusUpdateDto;

  @ApiPropertyOptional({
    description: 'Additional notes about the payment',
    example: 'Wire transfer confirmed by bank on 2026-03-15',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
