import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({
    description: 'Fresh Privy access token from client SDK (obtained via getAccessToken())',
  })
  @IsString()
  @IsNotEmpty()
  privyAccessToken: string;
}
