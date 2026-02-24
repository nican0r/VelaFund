import {
  Controller,
  Get,
  Post,
  Param,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { MemberService } from './member.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Invitations')
@Controller('api/v1/invitations')
export class InvitationController {
  constructor(private readonly memberService: MemberService) {}

  @Get(':token')
  @Public()
  @Throttle({ read: { ttl: 60000, limit: 100 } })
  @ApiOperation({ summary: 'Get invitation details (public endpoint)' })
  @ApiParam({ name: 'token', description: 'Invitation token from the email link' })
  @ApiResponse({ status: 200, description: 'Invitation details' })
  @ApiResponse({ status: 404, description: 'Invitation not found or already used' })
  @ApiResponse({ status: 410, description: 'Invitation expired' })
  async getInvitationDetails(@Param('token') token: string) {
    return this.memberService.getInvitationDetails(token);
  }

  @Post(':token/accept')
  @Throttle({ write: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Accept an invitation and join the company' })
  @ApiParam({ name: 'token', description: 'Invitation token from the email link' })
  @ApiResponse({ status: 200, description: 'Invitation accepted, user is now a member' })
  @ApiResponse({ status: 404, description: 'Invitation not found or already used' })
  @ApiResponse({ status: 409, description: 'User is already a member of this company' })
  @ApiResponse({ status: 410, description: 'Invitation expired' })
  async acceptInvitation(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.memberService.acceptInvitation(token, user.id, user.email);
  }
}
