import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { CreateFavoriteDto } from './dto/create-favorite.dto';

export interface UserFavoriteResponse {
  id: string;
  user_id: string;
  name: string;
  address: string;
  start_address?: string | null;
  start_coordinates?: {
    lat: number;
    lng: number;
  } | null;
  icon: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  created_at?: string;
}

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async getFavorites(userId: string): Promise<UserFavoriteResponse[]> {
    this.logger.log(`Récupération des favoris pour l'utilisateur ${userId}`);

    const { data, error } = await this.supabase
      .from('user_favorites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(
        `Erreur récupération favoris: ${error.message}`,
        error,
      );
      throw new InternalServerErrorException(
        'Impossible de récupérer les favoris',
      );
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      name: row.title || row.name || 'Favori',
      address: row.address,
      start_address: row.start_address || null,
      start_coordinates:
        row.start_latitude != null && row.start_longitude != null
          ? {
              lat: Number(row.start_latitude),
              lng: Number(row.start_longitude),
            }
          : null,
      icon: (row.icon || 'home').toLowerCase(),
      coordinates: {
        lat: Number(row.latitude),
        lng: Number(row.longitude),
      },
      created_at: row.created_at,
    }));
  }

  async addFavorite(
    userId: string,
    dto: CreateFavoriteDto,
  ): Promise<UserFavoriteResponse> {
    this.logger.log(`Ajout du favori "${dto.name}" pour ${userId}`);

    const { data, error } = await this.supabase
      .from('user_favorites')
      .insert({
        user_id: userId,
        title: dto.name,
        address: dto.address,
        latitude: dto.coordinates.lat,
        longitude: dto.coordinates.lng,
        start_address: dto.start_address || null,
        start_latitude: dto.start_coordinates?.lat ?? null,
        start_longitude: dto.start_coordinates?.lng ?? null,
        icon: dto.icon || 'home',
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Erreur insertion favori: ${error.message}`, error);
      throw new InternalServerErrorException(
        "Impossible d'enregistrer le favori",
      );
    }

    return {
      id: data.id,
      user_id: data.user_id,
      name: data.title || data.name || dto.name,
      address: data.address,
      start_address: data.start_address || null,
      start_coordinates:
        data.start_latitude != null && data.start_longitude != null
          ? {
              lat: Number(data.start_latitude),
              lng: Number(data.start_longitude),
            }
          : null,
      icon: (data.icon || dto.icon || 'home').toLowerCase(),
      coordinates: {
        lat: Number(data.latitude),
        lng: Number(data.longitude),
      },
      created_at: data.created_at,
    };
  }

  async deleteFavorite(
    userId: string,
    favoriteId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Suppression du favori ${favoriteId} pour ${userId}`);

    // Vérification de l'existence et propriété du favori
    const { data: existingFav, error: fetchError } = await this.supabase
      .from('user_favorites')
      .select('id, user_id')
      .eq('id', favoriteId)
      .single();

    if (fetchError || !existingFav) {
      throw new NotFoundException('Favori introuvable');
    }

    if (existingFav.user_id !== userId) {
      throw new BadRequestException(
        "Vous n'avez pas l'autorisation de supprimer ce favori",
      );
    }

    const { error: deleteError } = await this.supabase
      .from('user_favorites')
      .delete()
      .eq('id', favoriteId)
      .eq('user_id', userId);

    if (deleteError) {
      this.logger.error(
        `Erreur suppression favori: ${deleteError.message}`,
        deleteError,
      );
      throw new InternalServerErrorException(
        'Impossible de supprimer le favori',
      );
    }

    return {
      success: true,
      message: 'Favori supprimé avec succès',
    };
  }
}
