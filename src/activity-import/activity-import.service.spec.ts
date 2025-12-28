import { Test, TestingModule } from '@nestjs/testing';
import { ActivityImportService } from './activity-import.service';

describe('ActivityImportService', () => {
  let service: ActivityImportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivityImportService],
    }).compile();

    service = module.get<ActivityImportService>(ActivityImportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
