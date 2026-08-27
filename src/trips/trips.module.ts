import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { Co2StatsController } from './co2-stats.controller';
import { UserTripsController } from './user-trips.controller';
import { TripsService } from './trips.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [TripsController, Co2StatsController, UserTripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
