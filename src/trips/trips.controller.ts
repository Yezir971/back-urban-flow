import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TripsService } from './trips.service';
import { createTripSchema, CreateTripDto } from './dto/create-trip.dto';

@Controller('api/trips')
@UseGuards(SupabaseAuthGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async recordTrip(@CurrentUser() user: any, @Body() body: unknown) {
    const userId = user?.id || user?.sub;
    if (!userId) {
      throw new BadRequestException('Utilisateur non authentifié');
    }

    const parseResult = createTripSchema.safeParse(body);
    if (!parseResult.success) {
      const messages = parseResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(', ');
      throw new BadRequestException(
        messages || 'Données du trajet invalides',
      );
    }

    return this.tripsService.recordTrip(
      userId,
      parseResult.data as CreateTripDto,
    );
  }

  @Get('recent')
  async getRecentTrips(
    @CurrentUser() user: any,
    @Query('limit') limitQuery?: string,
  ) {
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
