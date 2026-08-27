import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { ItineraireModule } from './itineraire/itineraire.module';
import { ProfileModule } from './profile/profile.module';
import { UserPreferencesModule } from './user-preferences/user-preferences.module';
import { TripsModule } from './trips/trips.module';
import { FavoritesModule } from './favorites/favorites.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    SupabaseModule,
    AuthModule,
    GeocodingModule,
    ItineraireModule,
    ProfileModule,
    UserPreferencesModule,
    TripsModule,
    FavoritesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
