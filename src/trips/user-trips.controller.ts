import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TripsService, UserTripResponse } from './trips.service';

@Controller('api/user/trips')
@UseGuards(SupabaseAuthGuard)
export class UserTripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  async getUserTrips(
    @CurrentUser() user: any,
    @Query('limit') limitQuery?: string,
  ): Promise<UserTripResponse[]> {
    const userId = user?.id || user?.sub;
    if (!userId) {
      throw new BadRequestException('Utilisateur non authentifié');
    }

    const limit = limitQuery ? parseInt(limitQuery, 10) : 5;
    return this.tripsService.getRecentTrips(
      userId,
      isNaN(limit) ? 5 : Math.min(Math.max(limit, 1), 50),
    );
  }
}
