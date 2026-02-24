import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { MemberService } from './member.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { paginate } from '../common/helpers/paginate';

@ApiTags('Members')
@Controller('api/v1/companies/:companyId/members')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Invite a new member to the company' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiResponse({ status: 201, description: 'Member invited successfully' })
  @ApiResponse({ status: 409, description: 'Member already exists or invitation pending' })
  async invite(
    @Param('companyId') companyId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.memberService.invite(companyId, dto, userId);
  }

  @Get()
  @Roles('ADMIN', 'FINANCE', 'LEGAL', 'INVESTOR', 'EMPLOYEE')
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'List company members' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiResponse({ status: 200, description: 'Paginated list of members' })
  async list(
    @Param('companyId') companyId: string,
    @Query() query: ListMembersQueryDto,
  ) {
    const { items, total } = await this.memberService.listMembers(
      companyId,
      query,
    );
    return paginate(items, total, query.page, query.limit);
  }

  @Put(':memberId')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Update member role or permissions' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  @ApiResponse({ status: 422, description: 'Last admin constraint or protected permission' })
  async update(
    @Param('companyId') companyId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.memberService.updateMember(companyId, memberId, dto);
  }

  @Delete(':memberId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Remove a member from the company' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({ status: 204, description: 'Member removed successfully' })
  @ApiResponse({ status: 422, description: 'Cannot remove last admin' })
  async remove(
    @Param('companyId') companyId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.memberService.removeMember(companyId, memberId, userId);
  }

  @Post(':memberId/resend-invitation')
  @Roles('ADMIN')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Resend an invitation email with a new token' })
  @ApiParam({ name: 'companyId', description: 'Company ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID of the pending invitation' })
  @ApiResponse({ status: 200, description: 'Invitation resent successfully' })
  @ApiResponse({ status: 422, description: 'Member is not in pending status' })
  async resendInvitation(
    @Param('companyId') companyId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.memberService.resendInvitation(companyId, memberId);
  }
}
