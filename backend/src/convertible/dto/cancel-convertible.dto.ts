import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelConvertibleDto {
  @ApiProperty({
    description: 'Reason for cancellation',
    example: 'Investor withdrew commitment',
  })
  @IsString()
  @IsNotEmpty()
  cancellationReason: string;
}
