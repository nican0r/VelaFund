import { IsEnum, IsOptional, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MemberRoleDto } from './invite-member.dto';

export class PermissionOverridesDto {
  @IsOptional() @IsBoolean() capTableRead?: boolean;
  @IsOptional() @IsBoolean() capTableWrite?: boolean;
  @IsOptional() @IsBoolean() transactionsCreate?: boolean;
  @IsOptional() @IsBoolean() transactionsApprove?: boolean;
  @IsOptional() @IsBoolean() documentsCreate?: boolean;
  @IsOptional() @IsBoolean() documentsSign?: boolean;
  @IsOptional() @IsBoolean() usersManage?: boolean;
  @IsOptional() @IsBoolean() reportsView?: boolean;
  @IsOptional() @IsBoolean() reportsExport?: boolean;
  @IsOptional() @IsBoolean() auditView?: boolean;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({
    description: 'New role for the member',
    enum: MemberRoleDto,
  })
  @IsOptional()
  @IsEnum(MemberRoleDto)
  role?: MemberRoleDto;

  @ApiPropertyOptional({
    description: 'Fine-grained permission overrides. Set to null to clear all overrides.',
    type: PermissionOverridesDto,
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PermissionOverridesDto)
  permissions?: PermissionOverridesDto | null;
}
