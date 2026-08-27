import {
  Controller,
  Get,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TripsService, UserCo2StatsResponse } from './trips.service';

@Controller('api/user/co2-stats')
@UseGuards(SupabaseAuthGuard)
export class Co2StatsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  async getCo2Stats(@CurrentUser() user: any): Promise<UserCo2StatsResponse> {
    const userId = user?.id || user?.sub;
    if (!userId) {
      throw new BadRequestException('Utilisateur non authentifié');
    }

    return this.tripsService.getCo2Stats(userId);
  }
}
