import { Test, TestingModule } from '@nestjs/testing';
import { FavoritesService } from './favorites.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let mockSupabase: any;

  beforeEach(async () => {
    mockSupabase = {
      from: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        {
          provide: SUPABASE_CLIENT,
          useValue: mockSupabase,
        },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFavorites', () => {
    it('should return list of mapped favorites', async () => {
      const mockDbData = [
        {
          id: 'fav-1',
          user_id: 'user-1',
          title: 'Travail',
          address: '123 Rue de Lyon',
          latitude: 45.76,
          longitude: 4.84,
          icon: 'work',
          created_at: '2026-08-27T10:00:00Z',
        },
      ];

      const queryMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockDbData, error: null }),
      };

      mockSupabase.from.mockReturnValue(queryMock);

      const result = await service.getFavorites('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'fav-1',
        user_id: 'user-1',
        name: 'Travail',
        address: '123 Rue de Lyon',
        start_address: null,
        start_coordinates: null,
        icon: 'work',
        coordinates: { lat: 45.76, lng: 4.84 },
        created_at: '2026-08-27T10:00:00Z',
      });
    });
  });

  describe('addFavorite', () => {
    it('should insert and return a new favorite', async () => {
      const mockInserted = {
        id: 'fav-2',
        user_id: 'user-1',
        title: 'Domicile',
        address: 'Place Bellecour, Lyon',
        latitude: 45.7578,
        longitude: 4.8322,
        icon: 'home',
        created_at: '2026-08-27T12:00:00Z',
      };

      const insertMock = {
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockInserted, error: null }),
        }),
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue(insertMock),
      });

      const result = await service.addFavorite('user-1', {
        name: 'Domicile',
        address: 'Place Bellecour, Lyon',
        icon: 'home',
        coordinates: { lat: 45.7578, lng: 4.8322 },
      });

      expect(result.id).toBe('fav-2');
      expect(result.name).toBe('Domicile');
      expect(result.coordinates).toEqual({ lat: 45.7578, lng: 4.8322 });
    });
  });

  describe('deleteFavorite', () => {
    it('should delete a favorite if owned by the user', async () => {
      const selectEqMock = {
        single: jest.fn().mockResolvedValue({
          data: { id: 'fav-1', user_id: 'user-1' },
          error: null,
        }),
      };
      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue(selectEqMock),
      });

      const deleteSecondEqMock = jest.fn().mockResolvedValue({ error: null });
      const deleteFirstEqMock = jest.fn().mockReturnValue({
        eq: deleteSecondEqMock,
      });
      const deleteMock = jest.fn().mockReturnValue({
        eq: deleteFirstEqMock,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        return {
          select: selectMock,
          delete: deleteMock,
        };
      });

      const result = await service.deleteFavorite('user-1', 'fav-1');
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException if favorite does not exist', async () => {
      const fetchMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      mockSupabase.from.mockReturnValue(fetchMock);

      await expect(service.deleteFavorite('user-1', 'unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if favorite belongs to another user', async () => {
      const fetchMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'fav-1', user_id: 'other-user' },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(fetchMock);

      await expect(service.deleteFavorite('user-1', 'fav-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
