import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';

describe('ProfileService', () => {
  let service: ProfileService;
  let mockSupabase: any;

  beforeEach(async () => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      storage: {
        listBuckets: jest.fn().mockResolvedValue({ data: [{ id: 'avatars' }] }),
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({ data: { path: 'avatar.jpg' }, error: null }),
          getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/avatar.jpg' } }),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: SUPABASE_CLIENT,
          useValue: mockSupabase,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return user profile with level label', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: 'user-123',
        username: 'Alexandre Dupont',
        avatar_url: 'https://example.com/photo.jpg',
        level: 3,
      },
      error: null,
    });

    const result = await service.getProfile('user-123');
    expect(result.username).toBe('Alexandre Dupont');
    expect(result.level_label).toBe('Voyageur Écolo');
  });

  it('should update username', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: 'user-123',
        username: 'Nouveau Nom',
        level: 1,
      },
      error: null,
    });

    const result = await service.updateProfile('user-123', { username: 'Nouveau Nom' });
    expect(result.username).toBe('Nouveau Nom');
    expect(result.level_label).toBe('Éco-Débutant');
  });
});
