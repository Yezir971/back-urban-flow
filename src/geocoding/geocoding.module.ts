import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeocodingService } from './geocoding.service';

@Module({
  imports: [ConfigModule],
  providers: [GeocodingService],
  exports: [GeocodingService],
})
export class GeocodingModule {}
