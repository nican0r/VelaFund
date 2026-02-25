import { IsString, Matches, IsNotEmpty } from 'class-validator';

export class VerifyCpfDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, {
    message: 'CPF must be in format XXX.XXX.XXX-XX',
  })
  cpf: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: 'Date of birth must be in format DD/MM/YYYY',
  })
  dateOfBirth: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;
}
