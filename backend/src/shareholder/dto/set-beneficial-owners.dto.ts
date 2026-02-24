import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BeneficialOwnerDto {
  @ApiProperty({
    description: 'Full name of beneficial owner',
    example: 'Maria Souza',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'CPF of beneficial owner (XXX.XXX.XXX-XX)',
    example: '123.456.789-09',
  })
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiProperty({
    description: 'Ownership percentage (0-100)',
    example: '60.00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'ownershipPercentage must be a decimal string with up to 2 decimal places',
  })
  ownershipPercentage: string;
}

export class SetBeneficialOwnersDto {
  @ApiProperty({
    description: 'Array of beneficial owners',
    type: [BeneficialOwnerDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BeneficialOwnerDto)
  beneficialOwners: BeneficialOwnerDto[];
}
