import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Privy access token from client SDK' })
  @IsString()
  @IsNotEmpty()
  privyAccessToken: string;
}
