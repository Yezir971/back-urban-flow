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
}
