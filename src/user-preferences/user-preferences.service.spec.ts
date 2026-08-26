import { Test, TestingModule } from '@nestjs/testing';
import { UserPreferencesService } from './user-preferences.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { WalkingSpeed } from './dto/update-user-preferences.dto';

describe('UserPreferencesService', () => {
  let service: UserPreferencesService;
  let mockSupabase: any;

  beforeEach(async () => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserPreferencesService,
        {
          provide: SUPABASE_CLIENT,
          useValue: mockSupabase,
        },
      ],
    }).compile();

    service = module.get<UserPreferencesService>(UserPreferencesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return user preferences if found', async () => {
    const mockData = {
      user_id: 'user-123',
      walking_speed: WalkingSpeed.NORMAL,
      pref_metro: true,
      pref_bus: true,
      pref_bike: false,
      pref_car: false,
      pref_walk: true,
    };

    mockSupabase.single.mockResolvedValueOnce({
      data: mockData,
      error: null,
    });

    const res = await service.getPreferences('user-123');
    expect(res.pref_bike).toBe(false);
    expect(res.walking_speed).toBe(WalkingSpeed.NORMAL);
  });

  it('should update user preferences', async () => {
    const updatedData = {
      user_id: 'user-123',
      walking_speed: WalkingSpeed.FAST,
      pref_metro: true,
      pref_bus: false,
      pref_bike: true,
      pref_car: true,
      pref_walk: true,
    };

    mockSupabase.single.mockResolvedValueOnce({
      data: updatedData,
      error: null,
    });

    const res = await service.updatePreferences('user-123', {
      walking_speed: WalkingSpeed.FAST,
      pref_metro: true,
      pref_bus: false,
      pref_bike: true,
      pref_car: true,
      pref_walk: true,
    });

    expect(res.walking_speed).toBe(WalkingSpeed.FAST);
    expect(res.pref_bus).toBe(false);
  });
});
