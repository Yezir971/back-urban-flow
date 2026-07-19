import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseAuthGuard } from './supabase.guard';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { SupabaseClient, User } from '@supabase/supabase-js';

describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;
  let mockGetUser: jest.Mock;

  beforeEach(async () => {
    mockGetUser = jest.fn();
    const mockSupabaseClient = {
      auth: {
        getUser: mockGetUser,
      },
    } as unknown as SupabaseClient;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseAuthGuard,
        {
          provide: SUPABASE_CLIENT,
          useValue: mockSupabaseClient,
        },
      ],
    }).compile();

    guard = module.get<SupabaseAuthGuard>(SupabaseAuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    let context: ExecutionContext;
    let request: { headers: Record<string, string>; user?: unknown };

    beforeEach(() => {
      request = {
        headers: {},
      };
      context = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext;
    });

    it('should throw UnauthorizedException if Authorization header is missing', async () => {
      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException("Token d'authentification manquant"),
      );
    });

    it('should throw UnauthorizedException if Authorization header does not start with Bearer', async () => {
      request.headers.authorization = 'Basic credentials';
      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException("Token d'authentification manquant"),
      );
    });

    it('should throw UnauthorizedException if Supabase returns an error', async () => {
      request.headers.authorization = 'Bearer invalid-token';
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Invalid token'),
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException(
          "Token d'authentification invalide ou expiré",
        ),
      );
      expect(mockGetUser).toHaveBeenCalledWith('invalid-token');
    });

    it('should throw UnauthorizedException if Supabase returns no user', async () => {
      request.headers.authorization = 'Bearer expired-token';
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException(
          "Token d'authentification invalide ou expiré",
        ),
      );
      expect(mockGetUser).toHaveBeenCalledWith('expired-token');
    });

    it('should populate request.user and return true if JWT is valid', async () => {
      request.headers.authorization = 'Bearer valid-token';
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
      } as unknown as User;
      mockGetUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.user).toEqual(mockUser);
      expect(mockGetUser).toHaveBeenCalledWith('valid-token');
    });
  });
});
