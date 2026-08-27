import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FavoritesService, UserFavoriteResponse } from './favorites.service';
import {
  createFavoriteSchema,
  CreateFavoriteDto,
} from './dto/create-favorite.dto';

@Controller('api/user/favorites')
@UseGuards(SupabaseAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  async getFavorites(@CurrentUser() user: any): Promise<UserFavoriteResponse[]> {
    const userId = user?.id || user?.sub;
    if (!userId) {
      throw new BadRequestException('Utilisateur non authentifié');
    }

    return this.favoritesService.getFavorites(userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addFavorite(
    @CurrentUser() user: any,
    @Body() body: unknown,
  ): Promise<UserFavoriteResponse> {
    const userId = user?.id || user?.sub;
    if (!userId) {
      throw new BadRequestException('Utilisateur non authentifié');
    }

    const parseResult = createFavoriteSchema.safeParse(body);
    if (!parseResult.success) {
      const messages = parseResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(', ');
      throw new BadRequestException(
        messages || 'Données du favori invalides',
      );
    }

    return this.favoritesService.addFavorite(
      userId,
      parseResult.data as CreateFavoriteDto,
    );
  }

  @Delete(':id')
  async deleteFavorite(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    const userId = user?.id || user?.sub;
    if (!userId) {
      throw new BadRequestException('Utilisateur non authentifié');
    }

    if (!id) {
      throw new BadRequestException('ID du favori requis');
    }

    return this.favoritesService.deleteFavorite(userId, id);
  }
}
