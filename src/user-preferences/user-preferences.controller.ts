import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserPreferencesService } from './user-preferences.service';
import {
  updateUserPreferencesSchema,
  UpdateUserPreferencesDto,
} from './dto/update-user-preferences.dto';

@Controller('api/user/preferences')
@UseGuards(SupabaseAuthGuard)
export class UserPreferencesController {
  constructor(
    private readonly userPreferencesService: UserPreferencesService,
  ) {}

  @Get()
  async getPreferences(@CurrentUser() user: any) {
    const userId = user?.id || user?.sub;
    if (!userId) {
      throw new BadRequestException('Utilisateur non authentifié');
    }
    return this.userPreferencesService.getPreferences(userId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async updatePreferences(
    @CurrentUser() user: any,
    @Body() body: unknown,
  ) {
    const userId = user?.id || user?.sub;
    if (!userId) {
      throw new BadRequestException('Utilisateur non authentifié');
    }

    const parseResult = updateUserPreferencesSchema.safeParse(body);
    if (!parseResult.success) {
      const messages = parseResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(', ');
      throw new BadRequestException(
        messages || 'Validation des préférences invalide',
      );
    }
    return this.userPreferencesService.updatePreferences(
      userId,
      parseResult.data as UpdateUserPreferencesDto,
    );
  }
}
