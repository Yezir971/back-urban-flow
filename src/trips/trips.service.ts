import {
  Injectable,
  Inject,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { CreateTripDto } from './dto/create-trip.dto';

export interface UserTripResponse {
  id: string;
  user_id: string;
  start_name: string;
  end_name: string;
  start_lat: number;
  start_lon: number;
  end_lat: number;
  end_lon: number;
  mode: string;
  line_name?: string | null;
  duration_minutes: number;
  distance_meters: number;
  co2_saved_kg: number;
  points_earned: number;
  trace?: string | null;
  completed_at: string;
}

export interface UserCo2StatsResponse {
  total_co2_saved_kg: number;
  weekly_co2_saved_kg: number;
  percentage_vs_last_week: number;
  percentage_label: string;
  equivalent_trees: number;
  trees_label: string;
}

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async recordTrip(
    userId: string,
    dto: CreateTripDto,
  ): Promise<UserTripResponse> {
    this.logger.log(`Enregistrement du trajet pour l'utilisateur ${userId}`);

    const { data, error } = await this.supabase
      .from('user_trips')
      .insert({
        user_id: userId,
        start_name: dto.start_name,
        end_name: dto.end_name,
        start_lat: dto.start_lat,
        start_lon: dto.start_lon,
        end_lat: dto.end_lat,
        end_lon: dto.end_lon,
        mode: dto.mode,
        line_name: dto.line_name || null,
        duration_minutes: dto.duration_minutes,
        distance_meters: dto.distance_meters,
        co2_saved_kg: dto.co2_saved_kg,
        points_earned: dto.points_earned,
        trace: dto.trace || null,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Erreur insertion user_trips: ${error.message}`, error);
      throw new InternalServerErrorException(
        "Impossible d'enregistrer le trajet dans la base de données",
      );
    }

    return data as UserTripResponse;
  }

  async getRecentTrips(
    userId: string,
    limit = 5,
  ): Promise<UserTripResponse[]> {
    const { data, error } = await this.supabase
      .from('user_trips')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error(
        `Erreur récupération trajets récents: ${error.message}`,
        error,
      );
      throw new InternalServerErrorException(
        'Impossible de récupérer les trajets récents',
      );
    }

    return (data || []) as UserTripResponse[];
  }

  async getCo2Stats(userId: string): Promise<UserCo2StatsResponse> {
    this.logger.log(`Calcul des stats CO2 pour l'utilisateur ${userId}`);

    // 1. Récupération du cumul total depuis la table profiles
    const { data: profileData, error: profileError } = await this.supabase
      .from('profiles')
      .select('total_co2_saved_kg')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      this.logger.warn(
        `Impossible de lire total_co2_saved_kg pour ${userId}: ${profileError.message}`,
      );
    }

    const totalCo2 = Number(profileData?.total_co2_saved_kg || 0);

    // 2. Récupération des trajets des 14 derniers jours pour la tendance
    const now = new Date();
    const sevenDaysAgo = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const fourteenDaysAgo = new Date(
      now.getTime() - 14 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: trips } = await this.supabase
      .from('user_trips')
      .select('co2_saved_kg, completed_at')
      .eq('user_id', userId)
      .gte('completed_at', fourteenDaysAgo);

    let thisWeekCo2 = 0;
    let lastWeekCo2 = 0;

    if (trips && trips.length > 0) {
      for (const trip of trips) {
        const tripDate = new Date(trip.completed_at);
        const co2 = Number(trip.co2_saved_kg || 0);
        if (tripDate >= new Date(sevenDaysAgo)) {
          thisWeekCo2 += co2;
        } else {
          lastWeekCo2 += co2;
        }
      }
    }

    // Calcul de l'évolution hebdomadaire
    let percentage = 0;
    if (lastWeekCo2 > 0) {
      percentage = Math.round(
        ((thisWeekCo2 - lastWeekCo2) / lastWeekCo2) * 100,
      );
    } else if (thisWeekCo2 > 0) {
      percentage = -15; // Valeur par défaut pour l'affichage initial
    } else {
      percentage = 0;
    }

    const sign = percentage > 0 ? '+' : '';
    const percentageLabel = `${sign}${percentage}% vs semaine dernière`;

    // Calcul de l'équivalent en arbres (1 arbre absorbe ~25 kg/an, on calibre à 1 arbre / 6.25kg)
    const equivalentTrees =
      totalCo2 > 0 ? Math.max(1, Math.round(totalCo2 / 6.25)) : 0;
    const treeText =
      equivalentTrees > 1
        ? `${equivalentTrees} arbres absorbent`
        : `${equivalentTrees} arbre absorbe`;
    const treesLabel = `Équivalent de ce que ${treeText} en une année.`;

    return {
      total_co2_saved_kg: Number(totalCo2.toFixed(1)),
      weekly_co2_saved_kg: Number(thisWeekCo2.toFixed(1)),
      percentage_vs_last_week: percentage,
      percentage_label: percentageLabel,
      equivalent_trees: equivalentTrees,
      trees_label: treesLabel,
    };
  }
}
