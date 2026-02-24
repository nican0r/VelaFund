import { Module } from '@nestjs/common';
import { MemberController } from './member.controller';
import { InvitationController } from './invitation.controller';
import { MemberService } from './member.service';

@Module({
  controllers: [MemberController, InvitationController],
  providers: [MemberService],
  exports: [MemberService],
})
export class MemberModule {}
