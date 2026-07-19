import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ItineraireController } from './itineraire.controller';
import { ItineraireService } from './itineraire.service';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [ItineraireController],
  providers: [ItineraireService],
})
export class ItineraireModule {}
