import {
  Injectable,
  Inject,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import {
  UpdateUserPreferencesDto,
  WalkingSpeed,
} from './dto/update-user-preferences.dto';

export interface UserPreferencesResponse {
  user_id: string;
  walking_speed: WalkingSpeed;
  pref_metro: boolean;
  pref_bus: boolean;
  pref_bike: boolean;
  pref_car: boolean;
  pref_walk: boolean;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class UserPreferencesService {
  private readonly logger = new Logger(UserPreferencesService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Récupère les préférences de l'utilisateur connecté
   */
  async getPreferences(userId: string): Promise<UserPreferencesResponse> {
    const { data, error } = await this.supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      this.logger.log(
        `Préférences inexistantes pour ${userId}, initialisation par défaut...`,
      );
      const defaultPreferences = {
        user_id: userId,
        walking_speed: WalkingSpeed.NORMAL,
        pref_metro: true,
        pref_bus: true,
        pref_bike: true,
        pref_car: true,
        pref_walk: true,
      };

      const { data: inserted, error: insertError } = await this.supabase
        .from('user_preferences')
        .insert(defaultPreferences)
        .select('*')
        .single();

      if (insertError || !inserted) {
        this.logger.warn(
          `Erreur insertion préférences: ${insertError?.message}`,
        );
        return {
          ...defaultPreferences,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      return inserted;
    }

    return data;
  }

  /**
   * Met à jour les préférences de transport de l'utilisateur connecté
   */
  async updatePreferences(
    userId: string,
    dto: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesResponse> {
    if (!dto) {
      throw new BadRequestException('Les données de préférences sont requises');
    }

    const payload = {
      user_id: userId,
      walking_speed: dto.walking_speed,
      pref_metro: dto.pref_metro,
      pref_bus: dto.pref_bus,
      pref_bike: dto.pref_bike,
      pref_car: dto.pref_car,
      pref_walk: dto.pref_walk,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('user_preferences')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error || !data) {
      this.logger.error(`Erreur mise à jour préférences: ${error?.message}`);
      throw new InternalServerErrorException(
        'Impossible de sauvegarder les préférences utilisateur',
      );
    }

    return data;
  }
}
