import { Test, TestingModule } from '@nestjs/testing';
import { MemberService } from './member.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
  GoneException,
} from '../common/filters/app-exception';
import { MemberRoleDto } from './dto/invite-member.dto';

const mockCompany = {
  id: 'comp-1',
  name: 'Test Company',
  status: 'ACTIVE',
  logoUrl: null,
};

const mockMember = {
  id: 'member-1',
  companyId: 'comp-1',
  userId: 'user-2',
  email: 'member@example.com',
  role: 'INVESTOR',
  status: 'ACTIVE',
  permissions: null,
  invitedBy: 'user-1',
  invitedAt: new Date('2026-02-20T10:00:00Z'),
  acceptedAt: new Date('2026-02-21T10:00:00Z'),
  removedAt: null,
  removedBy: null,
  createdAt: new Date('2026-02-20T10:00:00Z'),
  updatedAt: new Date('2026-02-20T10:00:00Z'),
};

const mockPendingMember = {
  ...mockMember,
  id: 'member-pending',
  userId: null,
  email: 'pending@example.com',
  status: 'PENDING',
  acceptedAt: null,
  invitationToken: {
    id: 'token-1',
    companyMemberId: 'member-pending',
    token: 'abc123',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
  },
};

const mockInvitationToken = {
  id: 'token-1',
  companyMemberId: 'member-pending',
  token: 'valid-token-hex',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  usedAt: null,
  createdAt: new Date(),
  companyMember: {
    id: 'member-pending',
    companyId: 'comp-1',
    userId: null,
    email: 'invitee@example.com',
    role: 'INVESTOR',
    status: 'PENDING',
    invitedBy: 'user-1',
    invitedAt: new Date('2026-02-20T10:00:00Z'),
    company: { id: 'comp-1', name: 'Test Company', logoUrl: null },
  },
};

describe('MemberService', () => {
  let service: MemberService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      company: {
        findUnique: jest.fn(),
      },
      companyMember: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      invitationToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) =>
          fn(prisma),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MemberService>(MemberService);
  });

  // ─── INVITE ───────────────────────────────────────────────────────

  describe('invite', () => {
    const dto = { email: 'new@example.com', role: MemberRoleDto.INVESTOR };

    it('should create a new member and invitation token', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.companyMember.count.mockResolvedValue(0); // rate limit check
      prisma.companyMember.findUnique.mockResolvedValue(null); // no existing
      prisma.companyMember.create.mockResolvedValue({
        ...mockPendingMember,
        email: dto.email,
        role: dto.role,
      });
      prisma.invitationToken.create.mockResolvedValue({});

      const result = await service.invite('comp-1', dto, 'user-1');

      expect(result.email).toBe(dto.email);
      expect(result.role).toBe(dto.role);
      expect(prisma.companyMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'comp-1',
            email: dto.email,
            role: dto.role,
            status: 'PENDING',
            invitedBy: 'user-1',
          }),
        }),
      );
      expect(prisma.invitationToken.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if company does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.invite('bad-id', dto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BusinessRuleException if company is DISSOLVED', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        status: 'DISSOLVED',
      });

      await expect(
        service.invite('comp-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
      await expect(
        service.invite('comp-1', dto, 'user-1'),
      ).rejects.toMatchObject({ code: 'COMPANY_DISSOLVED' });
    });

    it('should throw BusinessRuleException if daily invitation limit exceeded', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.companyMember.count.mockResolvedValue(50);

      await expect(
        service.invite('comp-1', dto, 'user-1'),
      ).rejects.toMatchObject({ code: 'COMPANY_INVITATION_RATE_LIMIT' });
    });

    it('should throw ConflictException if email has an ACTIVE membership', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.companyMember.count.mockResolvedValue(0);
      prisma.companyMember.findUnique.mockResolvedValue({
        id: 'existing',
        status: 'ACTIVE',
      });

      await expect(
        service.invite('comp-1', dto, 'user-1'),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.invite('comp-1', dto, 'user-1'),
      ).rejects.toMatchObject({ code: 'COMPANY_MEMBER_EXISTS' });
    });

    it('should throw ConflictException if email has a PENDING invitation', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.companyMember.count.mockResolvedValue(0);
      prisma.companyMember.findUnique.mockResolvedValue({
        id: 'existing',
        status: 'PENDING',
      });

      await expect(
        service.invite('comp-1', dto, 'user-1'),
      ).rejects.toMatchObject({ code: 'COMPANY_INVITATION_PENDING' });
    });

    it('should re-invite a REMOVED member by updating the existing record', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.companyMember.count.mockResolvedValue(0);
      prisma.companyMember.findUnique.mockResolvedValue({
        id: 'removed-member',
        status: 'REMOVED',
      });
      prisma.companyMember.update.mockResolvedValue({
        ...mockPendingMember,
        id: 'removed-member',
        email: dto.email,
        role: dto.role,
        status: 'PENDING',
      });
      prisma.invitationToken.upsert.mockResolvedValue({});

      const result = await service.invite('comp-1', dto, 'user-1');

      expect(result.status).toBe('PENDING');
      expect(prisma.companyMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'removed-member' },
          data: expect.objectContaining({
            status: 'PENDING',
            userId: null,
            removedAt: null,
            removedBy: null,
          }),
        }),
      );
    });
  });

  // ─── LIST MEMBERS ─────────────────────────────────────────────────

  describe('listMembers', () => {
    it('should return paginated list of members', async () => {
      const members = [mockMember, mockPendingMember];
      prisma.companyMember.findMany.mockResolvedValue(members);
      prisma.companyMember.count.mockResolvedValue(2);

      const result = await service.listMembers('comp-1', {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should apply status filter', async () => {
      prisma.companyMember.findMany.mockResolvedValue([]);
      prisma.companyMember.count.mockResolvedValue(0);

      await service.listMembers('comp-1', {
        page: 1,
        limit: 20,
        status: 'ACTIVE' as any,
      });

      expect(prisma.companyMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('should apply role filter', async () => {
      prisma.companyMember.findMany.mockResolvedValue([]);
      prisma.companyMember.count.mockResolvedValue(0);

      await service.listMembers('comp-1', {
        page: 1,
        limit: 20,
        role: MemberRoleDto.ADMIN,
      });

      expect(prisma.companyMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'ADMIN' }),
        }),
      );
    });

    it('should apply search filter across email and user names', async () => {
      prisma.companyMember.findMany.mockResolvedValue([]);
      prisma.companyMember.count.mockResolvedValue(0);

      await service.listMembers('comp-1', {
        page: 1,
        limit: 20,
        search: 'john',
      });

      expect(prisma.companyMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { email: { contains: 'john', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });

  // ─── UPDATE MEMBER ────────────────────────────────────────────────

  describe('updateMember', () => {
    it('should update member role', async () => {
      prisma.companyMember.findFirst.mockResolvedValue(mockMember);
      prisma.companyMember.update.mockResolvedValue({
        ...mockMember,
        role: 'FINANCE',
      });

      const result = await service.updateMember('comp-1', 'member-1', {
        role: MemberRoleDto.FINANCE,
      });

      expect(result.role).toBe('FINANCE');
      expect(prisma.companyMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'FINANCE' }),
        }),
      );
    });

    it('should throw NotFoundException if member does not exist', async () => {
      prisma.companyMember.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMember('comp-1', 'bad-id', {
          role: MemberRoleDto.FINANCE,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if member is not ACTIVE', async () => {
      prisma.companyMember.findFirst.mockResolvedValue({
        ...mockMember,
        status: 'PENDING',
      });

      await expect(
        service.updateMember('comp-1', 'member-1', {
          role: MemberRoleDto.FINANCE,
        }),
      ).rejects.toMatchObject({ code: 'MEMBER_NOT_ACTIVE' });
    });

    it('should throw COMPANY_LAST_ADMIN when demoting the last admin', async () => {
      prisma.companyMember.findFirst.mockResolvedValue({
        ...mockMember,
        role: 'ADMIN',
      });
      // No other admins remain
      prisma.companyMember.count.mockResolvedValue(0);

      await expect(
        service.updateMember('comp-1', 'member-1', {
          role: MemberRoleDto.FINANCE,
        }),
      ).rejects.toMatchObject({ code: 'COMPANY_LAST_ADMIN' });
    });

    it('should allow demoting an admin when another admin exists', async () => {
      prisma.companyMember.findFirst.mockResolvedValue({
        ...mockMember,
        role: 'ADMIN',
      });
      // Another admin exists
      prisma.companyMember.count.mockResolvedValue(1);
      prisma.companyMember.update.mockResolvedValue({
        ...mockMember,
        role: 'FINANCE',
      });

      const result = await service.updateMember('comp-1', 'member-1', {
        role: MemberRoleDto.FINANCE,
      });

      expect(result.role).toBe('FINANCE');
    });

    it('should throw MEMBER_PERMISSION_PROTECTED for usersManage on non-ADMIN', async () => {
      prisma.companyMember.findFirst.mockResolvedValue(mockMember); // role: INVESTOR

      await expect(
        service.updateMember('comp-1', 'member-1', {
          permissions: { usersManage: true },
        }),
      ).rejects.toMatchObject({ code: 'MEMBER_PERMISSION_PROTECTED' });
    });

    it('should allow usersManage override for ADMIN role', async () => {
      prisma.companyMember.findFirst.mockResolvedValue({
        ...mockMember,
        role: 'ADMIN',
      });
      prisma.companyMember.update.mockResolvedValue({
        ...mockMember,
        role: 'ADMIN',
        permissions: { usersManage: true },
      });

      const result = await service.updateMember('comp-1', 'member-1', {
        permissions: { usersManage: true },
      });

      expect(result.permissions).toEqual({ usersManage: true });
    });

    it('should clear permissions when set to null', async () => {
      prisma.companyMember.findFirst.mockResolvedValue(mockMember);
      prisma.companyMember.update.mockResolvedValue({
        ...mockMember,
        permissions: null,
      });

      const result = await service.updateMember('comp-1', 'member-1', {
        permissions: null,
      });

      expect(result.permissions).toBeNull();
    });
  });

  // ─── REMOVE MEMBER ────────────────────────────────────────────────

  describe('removeMember', () => {
    it('should soft-remove an ACTIVE member', async () => {
      prisma.companyMember.findFirst.mockResolvedValue(mockMember); // INVESTOR
      prisma.companyMember.update.mockResolvedValue({
        ...mockMember,
        status: 'REMOVED',
      });

      await service.removeMember('comp-1', 'member-1', 'user-1');

      expect(prisma.companyMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REMOVED',
            removedBy: 'user-1',
          }),
        }),
      );
    });

    it('should remove a PENDING member', async () => {
      prisma.companyMember.findFirst.mockResolvedValue({
        ...mockMember,
        status: 'PENDING',
        role: 'INVESTOR',
      });
      prisma.companyMember.update.mockResolvedValue({});

      await service.removeMember('comp-1', 'member-1', 'user-1');

      expect(prisma.companyMember.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if member does not exist', async () => {
      prisma.companyMember.findFirst.mockResolvedValue(null);

      await expect(
        service.removeMember('comp-1', 'bad-id', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if member is already REMOVED', async () => {
      prisma.companyMember.findFirst.mockResolvedValue({
        ...mockMember,
        status: 'REMOVED',
      });

      await expect(
        service.removeMember('comp-1', 'member-1', 'user-1'),
      ).rejects.toMatchObject({ code: 'MEMBER_ALREADY_REMOVED' });
    });

    it('should throw COMPANY_LAST_ADMIN when removing the last admin', async () => {
      prisma.companyMember.findFirst.mockResolvedValue({
        ...mockMember,
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      prisma.companyMember.count.mockResolvedValue(0); // no other admins

      await expect(
        service.removeMember('comp-1', 'member-1', 'user-1'),
      ).rejects.toMatchObject({ code: 'COMPANY_LAST_ADMIN' });
    });

    it('should allow removing an admin when another admin exists', async () => {
      prisma.companyMember.findFirst.mockResolvedValue({
        ...mockMember,
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      prisma.companyMember.count.mockResolvedValue(1); // another admin exists
      prisma.companyMember.update.mockResolvedValue({});

      await service.removeMember('comp-1', 'member-1', 'user-1');

      expect(prisma.companyMember.update).toHaveBeenCalled();
    });
  });

  // ─── RESEND INVITATION ────────────────────────────────────────────

  describe('resendInvitation', () => {
    it('should generate a new token for a PENDING member', async () => {
      prisma.companyMember.findFirst.mockResolvedValue(mockPendingMember);
      prisma.invitationToken.upsert.mockResolvedValue({});

      const result = await service.resendInvitation('comp-1', 'member-pending');

      expect(result.id).toBe('member-pending');
      expect(result.email).toBe(mockPendingMember.email);
      expect(result.newExpiresAt).toBeDefined();
      expect(prisma.invitationToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyMemberId: 'member-pending' },
        }),
      );
    });

    it('should throw NotFoundException if member does not exist', async () => {
      prisma.companyMember.findFirst.mockResolvedValue(null);

      await expect(
        service.resendInvitation('comp-1', 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if member is not PENDING', async () => {
      prisma.companyMember.findFirst.mockResolvedValue({
        ...mockMember,
        status: 'ACTIVE',
      });

      await expect(
        service.resendInvitation('comp-1', 'member-1'),
      ).rejects.toMatchObject({ code: 'MEMBER_NOT_PENDING' });
    });
  });

  // ─── GET INVITATION DETAILS ───────────────────────────────────────

  describe('getInvitationDetails', () => {
    it('should return invitation details for a valid token', async () => {
      prisma.invitationToken.findUnique.mockResolvedValue(mockInvitationToken);
      prisma.user.findFirst.mockResolvedValue({ id: 'existing-user' });
      prisma.user.findUnique.mockResolvedValue({
        firstName: 'Admin',
        lastName: 'User',
      });

      const result = await service.getInvitationDetails('valid-token-hex');

      expect(result.companyName).toBe('Test Company');
      expect(result.role).toBe('INVESTOR');
      expect(result.invitedByName).toBe('Admin User');
      expect(result.hasExistingAccount).toBe(true);
      expect(result.email).toBe('invitee@example.com');
    });

    it('should throw NotFoundException if token does not exist', async () => {
      prisma.invitationToken.findUnique.mockResolvedValue(null);

      await expect(
        service.getInvitationDetails('bad-token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if token is already used', async () => {
      prisma.invitationToken.findUnique.mockResolvedValue({
        ...mockInvitationToken,
        usedAt: new Date(),
      });

      await expect(
        service.getInvitationDetails('used-token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw GoneException if token is expired', async () => {
      prisma.invitationToken.findUnique.mockResolvedValue({
        ...mockInvitationToken,
        expiresAt: new Date('2020-01-01'),
      });

      await expect(
        service.getInvitationDetails('expired-token'),
      ).rejects.toThrow(GoneException);
      await expect(
        service.getInvitationDetails('expired-token'),
      ).rejects.toMatchObject({ code: 'INVITATION_EXPIRED' });
    });

    it('should return hasExistingAccount=false if no user with that email', async () => {
      prisma.invitationToken.findUnique.mockResolvedValue(mockInvitationToken);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getInvitationDetails('valid-token-hex');

      expect(result.hasExistingAccount).toBe(false);
    });
  });

  // ─── ACCEPT INVITATION ────────────────────────────────────────────

  describe('acceptInvitation', () => {
    it('should activate the member and mark the token as used', async () => {
      prisma.invitationToken.findUnique.mockResolvedValue(mockInvitationToken);
      prisma.companyMember.findFirst.mockResolvedValue(null); // no existing membership
      prisma.companyMember.count.mockResolvedValue(0); // under limit
      prisma.companyMember.update.mockResolvedValue({
        ...mockInvitationToken.companyMember,
        userId: 'user-2',
        email: 'user2@example.com',
        status: 'ACTIVE',
        acceptedAt: new Date(),
        company: { id: 'comp-1', name: 'Test Company' },
      });
      prisma.invitationToken.update.mockResolvedValue({});

      const result = await service.acceptInvitation(
        'valid-token-hex',
        'user-2',
        'user2@example.com',
      );

      expect(result.memberId).toBe('member-pending');
      expect(result.companyName).toBe('Test Company');
      expect(result.role).toBe('INVESTOR');
      expect(result.status).toBe('ACTIVE');
      expect(prisma.companyMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-2',
            email: 'user2@example.com',
            status: 'ACTIVE',
          }),
        }),
      );
      expect(prisma.invitationToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      );
    });

    it('should throw NotFoundException if token does not exist', async () => {
      prisma.invitationToken.findUnique.mockResolvedValue(null);

      await expect(
        service.acceptInvitation('bad-token', 'user-2', 'user2@example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if token is already used', async () => {
      prisma.invitationToken.findUnique.mockResolvedValue({
        ...mockInvitationToken,
        usedAt: new Date(),
      });

      await expect(
        service.acceptInvitation('used-token', 'user-2', 'user2@example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw GoneException if token is expired', async () => {
      prisma.invitationToken.findUnique.mockResolvedValue({
        ...mockInvitationToken,
        expiresAt: new Date('2020-01-01'),
      });

      await expect(
        service.acceptInvitation(
          'expired-token',
          'user-2',
          'user2@example.com',
        ),
      ).rejects.toThrow(GoneException);
    });

    it('should throw BusinessRuleException if invitation already accepted', async () => {
      prisma.invitationToken.findUnique.mockResolvedValue({
        ...mockInvitationToken,
        companyMember: {
          ...mockInvitationToken.companyMember,
          status: 'ACTIVE',
        },
      });

      await expect(
        service.acceptInvitation(
          'valid-token',
          'user-2',
          'user2@example.com',
        ),
      ).rejects.toMatchObject({ code: 'INVITATION_ALREADY_ACCEPTED' });
    });

    it('should throw ConflictException if user is already an active member', async () => {
      prisma.invitationToken.findUnique.mockResolvedValue(mockInvitationToken);
      prisma.companyMember.findFirst.mockResolvedValue({
        id: 'existing-member',
      }); // already active

      await expect(
        service.acceptInvitation(
          'valid-token',
          'user-2',
          'user2@example.com',
        ),
      ).rejects.toMatchObject({ code: 'COMPANY_MEMBER_EXISTS' });
    });

    it('should throw COMPANY_MEMBER_LIMIT_REACHED if user is in 20+ companies', async () => {
      prisma.invitationToken.findUnique.mockResolvedValue(mockInvitationToken);
      prisma.companyMember.findFirst.mockResolvedValue(null);
      prisma.companyMember.count.mockResolvedValue(20);

      await expect(
        service.acceptInvitation(
          'valid-token',
          'user-2',
          'user2@example.com',
        ),
      ).rejects.toMatchObject({ code: 'COMPANY_MEMBER_LIMIT_REACHED' });
    });

    it('should allow acceptance even when email does not match (BR-6)', async () => {
      // Invitation was for invitee@example.com, but user-2 (different-email@example.com) accepts
      prisma.invitationToken.findUnique.mockResolvedValue(mockInvitationToken);
      prisma.companyMember.findFirst.mockResolvedValue(null);
      prisma.companyMember.count.mockResolvedValue(0);
      prisma.companyMember.update.mockResolvedValue({
        ...mockInvitationToken.companyMember,
        userId: 'user-2',
        email: 'different-email@example.com',
        status: 'ACTIVE',
        acceptedAt: new Date(),
        company: { id: 'comp-1', name: 'Test Company' },
      });
      prisma.invitationToken.update.mockResolvedValue({});

      const result = await service.acceptInvitation(
        'valid-token-hex',
        'user-2',
        'different-email@example.com',
      );

      // Email mismatch is allowed — the member email is updated to the accepting user's email
      expect(result.status).toBe('ACTIVE');
      expect(prisma.companyMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'different-email@example.com',
          }),
        }),
      );
    });
  });
});
