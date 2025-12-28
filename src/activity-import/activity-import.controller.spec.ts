import { Test, TestingModule } from '@nestjs/testing';
import { ActivityImportController } from './activity-import.controller';

describe('ActivityImportController', () => {
  let controller: ActivityImportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivityImportController],
    }).compile();

    controller = module.get<ActivityImportController>(ActivityImportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
