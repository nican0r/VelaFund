import { Test, TestingModule } from '@nestjs/testing';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';
import { MemberRoleDto } from './dto/invite-member.dto';

const mockMember = {
  id: 'member-1',
  companyId: 'comp-1',
  email: 'member@example.com',
  role: 'INVESTOR',
  status: 'ACTIVE',
  permissions: null,
  invitedBy: 'user-1',
  invitedAt: new Date(),
  acceptedAt: new Date(),
  removedAt: null,
  removedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: {
    id: 'user-2',
    firstName: 'John',
    lastName: 'Doe',
    profilePictureUrl: null,
    walletAddress: null,
  },
};

describe('MemberController', () => {
  let controller: MemberController;
  let service: jest.Mocked<MemberService>;

  beforeEach(async () => {
    const mockService = {
      invite: jest.fn(),
      listMembers: jest.fn(),
      updateMember: jest.fn(),
      removeMember: jest.fn(),
      resendInvitation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemberController],
      providers: [{ provide: MemberService, useValue: mockService }],
    }).compile();

    controller = module.get<MemberController>(MemberController);
    service = module.get(MemberService) as jest.Mocked<MemberService>;
  });

  // ─── INVITE ────────────────────────────────────────────────────────

  describe('invite', () => {
    it('should call memberService.invite with correct args', async () => {
      const dto = { email: 'new@example.com', role: MemberRoleDto.INVESTOR };
      service.invite.mockResolvedValue(mockMember as any);

      const result = await controller.invite('comp-1', dto, 'user-1');

      expect(service.invite).toHaveBeenCalledWith('comp-1', dto, 'user-1');
      expect(result).toEqual(mockMember);
    });

    it('should propagate service exceptions', async () => {
      const dto = { email: 'bad@example.com', role: MemberRoleDto.ADMIN };
      service.invite.mockRejectedValue(new Error('test'));

      await expect(controller.invite('comp-1', dto, 'user-1')).rejects.toThrow('test');
    });
  });

  // ─── LIST ──────────────────────────────────────────────────────────

  describe('list', () => {
    it('should return paginated members', async () => {
      service.listMembers.mockResolvedValue({
        items: [mockMember as any],
        total: 1,
      });

      const result = await controller.list('comp-1', {
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({
        success: true,
        data: [mockMember],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('should pass filters to service', async () => {
      service.listMembers.mockResolvedValue({ items: [], total: 0 });

      await controller.list('comp-1', {
        page: 2,
        limit: 10,
        status: 'ACTIVE' as any,
        role: MemberRoleDto.ADMIN,
        search: 'john',
        sort: '-createdAt',
      });

      expect(service.listMembers).toHaveBeenCalledWith('comp-1', {
        page: 2,
        limit: 10,
        status: 'ACTIVE',
        role: 'ADMIN',
        search: 'john',
        sort: '-createdAt',
      });
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────────

  describe('update', () => {
    it('should call memberService.updateMember', async () => {
      const dto = { role: MemberRoleDto.FINANCE };
      service.updateMember.mockResolvedValue({
        ...mockMember,
        role: 'FINANCE',
      } as any);

      const result = await controller.update('comp-1', 'member-1', dto);

      expect(service.updateMember).toHaveBeenCalledWith('comp-1', 'member-1', dto);
      expect(result.role).toBe('FINANCE');
    });
  });

  // ─── REMOVE ────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should call memberService.removeMember and return void', async () => {
      service.removeMember.mockResolvedValue(undefined);

      const result = await controller.remove('comp-1', 'member-1', 'user-1');

      expect(service.removeMember).toHaveBeenCalledWith('comp-1', 'member-1', 'user-1');
      expect(result).toBeUndefined();
    });
  });

  // ─── RESEND INVITATION ────────────────────────────────────────────

  describe('resendInvitation', () => {
    it('should call memberService.resendInvitation', async () => {
      const resendResult = {
        id: 'member-1',
        email: 'pending@example.com',
        status: 'PENDING',
        newExpiresAt: new Date(),
      };
      service.resendInvitation.mockResolvedValue(resendResult as any);

      const result = await controller.resendInvitation('comp-1', 'member-1');

      expect(service.resendInvitation).toHaveBeenCalledWith('comp-1', 'member-1');
      expect(result).toEqual(resendResult);
    });
  });
});
