import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupabaseAuthGuard } from '../auth/supabase.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProfileService, UserProfileResponse } from './profile.service';
import type { UploadedFilePayload } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('api/profile')
@UseGuards(SupabaseAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  async getMyProfile(@CurrentUser() user: any): Promise<UserProfileResponse> {
    if (!user || !user.id) {
      throw new BadRequestException('Utilisateur non authentifié');
    }
    return this.profileService.getProfile(user.id, user.email);
  }

  @Put('me')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileResponse> {
    if (!user || !user.id) {
      throw new BadRequestException('Utilisateur non authentifié');
    }
    return this.profileService.updateProfile(user.id, dto);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
      },
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/jpg',
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Format de fichier non supporté. Formats acceptés : JPEG, PNG, WebP',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: UploadedFilePayload,
  ): Promise<UserProfileResponse> {
    if (!user || !user.id) {
      throw new BadRequestException('Utilisateur non authentifié');
    }
    if (!file) {
      throw new BadRequestException('Veuillez sélectionner un fichier image');
    }
    return this.profileService.uploadAvatar(user.id, file);
  }
}
