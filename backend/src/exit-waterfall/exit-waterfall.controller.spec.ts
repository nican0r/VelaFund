import { Test, TestingModule } from '@nestjs/testing';
import { ExitWaterfallController } from './exit-waterfall.controller';
import { ExitWaterfallService } from './exit-waterfall.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThrottlerModule } from '@nestjs/throttler';

const mockUser = {
  id: 'user-1',
  privyUserId: 'privy-1',
  email: 'admin@navia.com.br',
  walletAddress: null,
  firstName: 'Nelson',
  lastName: 'Pereira',
  kycStatus: 'APPROVED',
  locale: 'pt-BR',
};

const mockWaterfallResult = {
  exitAmount: '10000000.00',
  generatedAt: '2026-02-25T10:00:00.000Z',
  shareClassResults: [
    {
      shareClassId: 'sc-common',
      shareClassName: 'ON',
      totalShares: '100000',
      liquidationPreference: '0.00',
      participationProceeds: '10000000.00',
      totalProceeds: '10000000.00',
      perShareValue: '100.00',
      roiMultiple: null,
      isParticipating: false,
      participationCapped: false,
    },
  ],
  breakeven: {
    exitValue: '0.00',
    description: 'No preferred classes',
  },
  unallocatedProceeds: '0.00',
};

describe('ExitWaterfallController', () => {
  let controller: ExitWaterfallController;
  let service: ExitWaterfallService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot()],
      controllers: [ExitWaterfallController],
      providers: [
        {
          provide: ExitWaterfallService,
          useValue: {
            runWaterfall: jest.fn(),
            saveScenario: jest.fn(),
            listScenarios: jest.fn(),
            getScenario: jest.fn(),
            deleteScenario: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<ExitWaterfallController>(ExitWaterfallController);
    service = module.get<ExitWaterfallService>(ExitWaterfallService);
  });

  // ─── runWaterfall ──────────────────────────────────────────────────────

  describe('runWaterfall', () => {
    it('should call service.runWaterfall and return result', async () => {
      (service.runWaterfall as jest.Mock).mockResolvedValue(mockWaterfallResult);

      const result = await controller.runWaterfall('comp-1', {
        exitAmount: '10000000.00',
      });

      expect(service.runWaterfall).toHaveBeenCalledWith('comp-1', {
        exitAmount: '10000000.00',
      });
      expect(result.exitAmount).toBe('10000000.00');
      expect(result.shareClassResults).toHaveLength(1);
    });

    it('should pass optional parameters through', async () => {
      (service.runWaterfall as jest.Mock).mockResolvedValue(mockWaterfallResult);

      await controller.runWaterfall('comp-1', {
        exitAmount: '5000000.00',
        shareClassOrder: ['sc-1', 'sc-2'],
        includeOptions: false,
        includeConvertibles: true,
      });

      expect(service.runWaterfall).toHaveBeenCalledWith('comp-1', {
        exitAmount: '5000000.00',
        shareClassOrder: ['sc-1', 'sc-2'],
        includeOptions: false,
        includeConvertibles: true,
      });
    });
  });

  // ─── saveScenario ──────────────────────────────────────────────────────

  describe('saveScenario', () => {
    it('should call service.saveScenario with user ID', async () => {
      const mockScenario = {
        id: 'scenario-1',
        name: 'Optimistic',
        exitAmount: '10000000.00',
        includeOptions: true,
        includeConvertibles: true,
        shareClassOrder: [],
        createdAt: '2026-02-25T10:00:00.000Z',
      };

      (service.saveScenario as jest.Mock).mockResolvedValue(mockScenario);

      const result = await controller.saveScenario('comp-1', mockUser as any, {
        name: 'Optimistic',
        exitAmount: '10000000.00',
        resultData: mockWaterfallResult as any,
      });

      expect(service.saveScenario).toHaveBeenCalledWith(
        'comp-1',
        'user-1',
        expect.objectContaining({ name: 'Optimistic' }),
      );
      expect(result.id).toBe('scenario-1');
    });
  });

  // ─── listScenarios ────────────────────────────────────────────────────

  describe('listScenarios', () => {
    it('should return paginated scenario list', async () => {
      (service.listScenarios as jest.Mock).mockResolvedValue({
        items: [
          {
            id: 'scenario-1',
            name: 'Optimistic',
            exitAmount: '10000000.00',
            createdBy: { id: 'user-1', name: 'Nelson Pereira' },
            createdAt: '2026-02-25T10:00:00.000Z',
          },
        ],
        total: 1,
      });

      const result = await controller.listScenarios('comp-1', {
        page: 1,
        limit: 20,
      });

      expect(service.listScenarios).toHaveBeenCalledWith('comp-1', 1, 20);
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta.total).toBe(1);
    });

    it('should pass custom pagination params', async () => {
      (service.listScenarios as jest.Mock).mockResolvedValue({
        items: [],
        total: 0,
      });

      await controller.listScenarios('comp-1', { page: 3, limit: 10 });

      expect(service.listScenarios).toHaveBeenCalledWith('comp-1', 3, 10);
    });
  });

  // ─── getScenario ──────────────────────────────────────────────────────

  describe('getScenario', () => {
    it('should return full scenario with result data', async () => {
      const mockScenario = {
        id: 'scenario-1',
        name: 'Optimistic',
        exitAmount: '10000000.00',
        resultData: mockWaterfallResult,
        createdBy: { id: 'user-1', name: 'Nelson Pereira' },
        createdAt: '2026-02-25T10:00:00.000Z',
      };

      (service.getScenario as jest.Mock).mockResolvedValue(mockScenario);

      const result = await controller.getScenario('comp-1', 'scenario-1');

      expect(service.getScenario).toHaveBeenCalledWith('comp-1', 'scenario-1');
      expect(result.resultData).toBeDefined();
    });
  });

  // ─── deleteScenario ───────────────────────────────────────────────────

  describe('deleteScenario', () => {
    it('should call service.deleteScenario', async () => {
      (service.deleteScenario as jest.Mock).mockResolvedValue(undefined);

      await controller.deleteScenario('comp-1', 'scenario-1');

      expect(service.deleteScenario).toHaveBeenCalledWith('comp-1', 'scenario-1');
    });
  });
});
