import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateExerciseRequestDto {
  @IsNotEmpty()
  @IsString()
  quantity: string;
}

export class ConfirmExercisePaymentDto {
  @IsOptional()
  @IsString()
  paymentNotes?: string;
}
