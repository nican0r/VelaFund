import { Test, TestingModule } from '@nestjs/testing';
import { InvitationController } from './invitation.controller';
import { MemberService } from './member.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const mockInvitationDetails = {
  companyName: 'Test Company',
  companyLogoUrl: null as string | null,
  role: 'INVESTOR' as const,
  invitedByName: 'Admin User',
  invitedAt: new Date('2026-02-20T10:00:00Z'),
  expiresAt: new Date('2026-02-27T10:00:00Z'),
  email: 'invitee@example.com',
  hasExistingAccount: false,
};

const mockAcceptResult = {
  memberId: 'member-1',
  companyId: 'comp-1',
  companyName: 'Test Company',
  role: 'INVESTOR' as const,
  status: 'ACTIVE' as const,
  acceptedAt: new Date(),
};

const mockUser: AuthenticatedUser = {
  id: 'user-2',
  privyUserId: 'privy-123',
  email: 'user2@example.com',
  walletAddress: null,
  firstName: 'John',
  lastName: 'Doe',
  kycStatus: 'NOT_STARTED',
  locale: 'pt-BR',
};

describe('InvitationController', () => {
  let controller: InvitationController;
  let service: jest.Mocked<MemberService>;

  beforeEach(async () => {
    const mockService = {
      getInvitationDetails: jest.fn(),
      acceptInvitation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationController],
      providers: [{ provide: MemberService, useValue: mockService }],
    }).compile();

    controller = module.get<InvitationController>(InvitationController);
    service = module.get(MemberService) as jest.Mocked<MemberService>;
  });

  // ─── GET INVITATION DETAILS ───────────────────────────────────────

  describe('getInvitationDetails', () => {
    it('should return invitation details for a valid token', async () => {
      service.getInvitationDetails.mockResolvedValue(mockInvitationDetails);

      const result = await controller.getInvitationDetails('valid-token');

      expect(service.getInvitationDetails).toHaveBeenCalledWith('valid-token');
      expect(result).toEqual(mockInvitationDetails);
    });

    it('should propagate NotFoundException for invalid tokens', async () => {
      service.getInvitationDetails.mockRejectedValue(new Error('Not found'));

      await expect(
        controller.getInvitationDetails('bad-token'),
      ).rejects.toThrow('Not found');
    });
  });

  // ─── ACCEPT INVITATION ────────────────────────────────────────────

  describe('acceptInvitation', () => {
    it('should accept invitation and return membership info', async () => {
      service.acceptInvitation.mockResolvedValue(mockAcceptResult);

      const result = await controller.acceptInvitation('valid-token', mockUser);

      expect(service.acceptInvitation).toHaveBeenCalledWith(
        'valid-token',
        'user-2',
        'user2@example.com',
      );
      expect(result).toEqual(mockAcceptResult);
    });

    it('should propagate service exceptions', async () => {
      service.acceptInvitation.mockRejectedValue(new Error('expired'));

      await expect(
        controller.acceptInvitation('expired-token', mockUser),
      ).rejects.toThrow('expired');
    });
  });
});
