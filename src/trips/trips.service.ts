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
  start_point: string;
  end_point: string;
  start_name: string;
  end_name: string;
  start_lat: number;
  start_lon: number;
  end_lat: number;
  end_lon: number;
  mode: string;
  line_name?: string | null;
  duration_minutes: number;
  distance_km: number;
  distance_meters: number;
  co2_saved_kg: number;
  points_earned: number;
  trace?: string | null;
  timestamp: string;
  completed_at: string;
}

export interface UserCo2StatsResponse {
  total_co2_saved_kg: number;
  total_co2_saved_g: number;
  formatted_co2: string;
  weekly_co2_saved_kg: number;
  percentage_vs_last_week: number;
  percentage_label: string;
  equivalent_car_km: number;
  equivalent_label: string;
  trees_label: string;
}

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  private mapTripRow(row: any): UserTripResponse {
    const distanceMeters = Number(row.distance_meters || 0);
    const distanceKm = Number((distanceMeters / 1000).toFixed(2));
    const timestamp = row.completed_at || new Date().toISOString();

    return {
      id: row.id,
      user_id: row.user_id,
      start_point: row.start_name || 'Départ',
      end_point: row.end_name || 'Arrivée',
      start_name: row.start_name || 'Départ',
      end_name: row.end_name || 'Arrivée',
      start_lat: Number(row.start_lat || 0),
      start_lon: Number(row.start_lon || 0),
      end_lat: Number(row.end_lat || 0),
      end_lon: Number(row.end_lon || 0),
      mode: (row.mode || 'WALK').toLowerCase(),
      line_name: row.line_name || null,
      duration_minutes: Number(row.duration_minutes || 0),
      distance_km: distanceKm,
      distance_meters: distanceMeters,
      co2_saved_kg: Number(row.co2_saved_kg || 0),
      points_earned: Number(row.points_earned || 0),
      trace: row.trace || null,
      timestamp: timestamp,
      completed_at: timestamp,
    };
  }

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

    return this.mapTripRow(data);
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

    return (data || []).map((row: any) => this.mapTripRow(row));
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

    // Calcul de l'équivalent concret du quotidien : km en voiture thermique évités (218 g CO2/km)
    const equivalentCarKm =
      totalCo2 > 0 ? Number(((totalCo2 * 1000) / 218).toFixed(1)) : 0;
    const formattedCarKm =
      equivalentCarKm < 10 ? equivalentCarKm : Math.round(equivalentCarKm);
    const equivalentLabel =
      totalCo2 > 0
        ? `Équivalent de ${formattedCarKm} km en voiture thermique évités.`
        : `Équivalent de 0 km en voiture thermique évité.`;

    const totalGrams = Math.round(totalCo2 * 1000);
    const formattedCo2 =
      totalCo2 < 1.0 && totalCo2 > 0
        ? `${totalGrams} g`
        : `${totalCo2.toFixed(1)} kg`;

    return {
      total_co2_saved_kg: Number(totalCo2.toFixed(2)),
      total_co2_saved_g: totalGrams,
      formatted_co2: formattedCo2,
      weekly_co2_saved_kg: Number(thisWeekCo2.toFixed(2)),
      percentage_vs_last_week: percentage,
      percentage_label: percentageLabel,
      equivalent_car_km: equivalentCarKm,
      equivalent_label: equivalentLabel,
      trees_label: equivalentLabel,
    };
  }
}
