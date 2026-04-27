import { HealthCheckService } from '@nestjs/terminus';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { ServerHealthIndicator } from './indicators/server.health';

describe('HealthController', () => {
  let controller: HealthController;

  const mockHealthCheckService = { check: jest.fn() };
  const mockDatabaseHealthIndicator = { isHealthy: jest.fn() };
  const mockServerHealthIndicator = { isHealthy: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: DatabaseHealthIndicator, useValue: mockDatabaseHealthIndicator },
        { provide: ServerHealthIndicator, useValue: mockServerHealthIndicator },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('Server 상태와 DB 상태를 포함한 health check를 실행한다', async () => {
    const result = {
      status: 'ok',
      info: {
        database: { status: 'up' },
        api: { status: 'up' },
      },
    };
    mockHealthCheckService.check.mockResolvedValue(result);

    await expect(controller.check()).resolves.toEqual(result);
    expect(mockHealthCheckService.check).toHaveBeenCalledWith([expect.any(Function), expect.any(Function)]);
  });
});
