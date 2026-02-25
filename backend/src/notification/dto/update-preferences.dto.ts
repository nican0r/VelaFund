import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ description: 'Enable transaction notifications' })
  @IsOptional()
  @IsBoolean()
  transactions?: boolean;

  @ApiPropertyOptional({ description: 'Enable document notifications' })
  @IsOptional()
  @IsBoolean()
  documents?: boolean;

  @ApiPropertyOptional({ description: 'Enable option notifications' })
  @IsOptional()
  @IsBoolean()
  options?: boolean;

  @ApiPropertyOptional({ description: 'Enable funding round notifications' })
  @IsOptional()
  @IsBoolean()
  fundingRounds?: boolean;

  // security is intentionally omitted — it cannot be changed
}
