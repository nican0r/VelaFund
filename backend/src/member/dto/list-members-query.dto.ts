import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { MemberRoleDto } from './invite-member.dto';

export enum MemberStatusFilterDto {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  REMOVED = 'REMOVED',
}

export class ListMembersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by member status', enum: MemberStatusFilterDto })
  @IsOptional()
  @IsEnum(MemberStatusFilterDto)
  status?: MemberStatusFilterDto;

  @ApiPropertyOptional({ description: 'Filter by role', enum: MemberRoleDto })
  @IsOptional()
  @IsEnum(MemberRoleDto)
  role?: MemberRoleDto;

  @ApiPropertyOptional({ description: 'Search by email or name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Sort field (prefix with - for descending)', example: '-invitedAt' })
  @IsOptional()
  @IsString()
  sort?: string;
}
