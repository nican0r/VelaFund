import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MemberRoleDto {
  ADMIN = 'ADMIN',
  FINANCE = 'FINANCE',
  LEGAL = 'LEGAL',
  INVESTOR = 'INVESTOR',
  EMPLOYEE = 'EMPLOYEE',
}

export class InviteMemberDto {
  @ApiProperty({ description: 'Email address to invite', example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Role to assign to the new member',
    enum: MemberRoleDto,
    example: 'INVESTOR',
  })
  @IsEnum(MemberRoleDto)
  role: MemberRoleDto;

  @ApiPropertyOptional({ description: 'Optional personal message included in the invitation email' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
