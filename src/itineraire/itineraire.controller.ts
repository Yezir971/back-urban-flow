import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase.guard';
import { ItineraireService } from './itineraire.service';

@Controller('api/route')
@UseGuards(SupabaseAuthGuard)
export class ItineraireController {
  constructor(private readonly itineraireService: ItineraireService) {}

  @Get()
  async getRoute(
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('mode') mode = 'WALK',
  ) {
    if (!start || !end) {
      throw new BadRequestException('Paramètres start et end requis');
    }

    return this.itineraireService.getWalkRoute(start, end, mode);
  }
}
