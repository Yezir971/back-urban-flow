import { Test, TestingModule } from '@nestjs/testing';
import { TripsService } from './trips.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { InternalServerErrorException } from '@nestjs/common';

describe('TripsService', () => {
  let service: TripsService;
  let mockSupabase: any;

  beforeEach(async () => {
    mockSupabase = {
      from: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripsService,
        {
          provide: SUPABASE_CLIENT,
          useValue: mockSupabase,
        },
      ],
    }).compile();

    service = module.get<TripsService>(TripsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordTrip', () => {
    it('should record a completed trip successfully', async () => {
      const mockTripData = {
        id: 'trip-123',
        user_id: 'user-1',
        start_name: 'Gare Part-Dieu',
        end_name: 'Bellecour',
        start_lat: 45.76,
        start_lon: 4.86,
        end_lat: 45.75,
        end_lon: 4.83,
        mode: 'TRANSIT',
        duration_minutes: 12,
        distance_meters: 2500,
        co2_saved_kg: 0.54,
        points_earned: 10,
        completed_at: new Date().toISOString(),
      };

      const selectMock = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockTripData, error: null }),
      });
      const insertMock = jest.fn().mockReturnValue({
        select: selectMock,
      });
      mockSupabase.from.mockReturnValue({
        insert: insertMock,
      });

      const result = await service.recordTrip('user-1', {
        start_name: 'Gare Part-Dieu',
        end_name: 'Bellecour',
        start_lat: 45.76,
        start_lon: 4.86,
        end_lat: 45.75,
        end_lon: 4.83,
        mode: 'TRANSIT',
        duration_minutes: 12,
        distance_meters: 2500,
        co2_saved_kg: 0.54,
        points_earned: 10,
      });

      expect(result).toEqual(mockTripData);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_trips');
    });

    it('should throw InternalServerErrorException on database error', async () => {
      const selectMock = jest.fn().mockReturnValue({
        single: jest
          .fn()
          .mockResolvedValue({ data: null, error: { message: 'DB Error' } }),
      });
      const insertMock = jest.fn().mockReturnValue({
        select: selectMock,
      });
      mockSupabase.from.mockReturnValue({
        insert: insertMock,
      });

      await expect(
        service.recordTrip('user-1', {
          start_name: 'Gare Part-Dieu',
          end_name: 'Bellecour',
          start_lat: 45.76,
          start_lon: 4.86,
          end_lat: 45.75,
          end_lon: 4.83,
          mode: 'TRANSIT',
          duration_minutes: 12,
          distance_meters: 2500,
          co2_saved_kg: 0.54,
          points_earned: 10,
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getCo2Stats', () => {
    it('should return calculated CO2 stats and car equivalent', async () => {
      const mockProfileQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { total_co2_saved_kg: 12.5 },
          error: null,
        }),
      };

      const mockTripsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({
          data: [
            {
              co2_saved_kg: 1.2,
              completed_at: new Date().toISOString(),
            },
          ],
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'profiles') return mockProfileQuery;
        if (tableName === 'user_trips') return mockTripsQuery;
        return {};
      });

      const result = await service.getCo2Stats('user-1');

      expect(result.total_co2_saved_kg).toBe(12.5);
      expect(result.equivalent_car_km).toBe(57.3);
      expect(result.equivalent_label).toContain('57 km en voiture thermique évités');
    });
  });
});
