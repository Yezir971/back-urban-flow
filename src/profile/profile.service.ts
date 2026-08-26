import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface UserProfileResponse {
  id: string;
  username: string;
  avatar_url: string;
  total_co2_saved_kg: number;
  total_distance_km: number;
  eco_points: number;
  level: number;
  level_label: string;
  role: string;
  created_at: string;
}

export interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {}

  private formatAvatarUrl(url?: string): string {
    if (!url) return '';
    const rawUrl = this.configService.get<string>('SUPABASE_PUBLIC_URL');
    const cleanBaseUrl = (rawUrl || '').replace(/\/$/, '');

    if (!cleanBaseUrl) return url;

    // Remplacement des hôtes internes docker par l'URL publique fournie en variable d'environnement
    return url
      .replace(/^http:\/\/(?:supabase-)?kong(?::\d+)?/, cleanBaseUrl)
      .replace(/^http:\/\/localhost:8000/, cleanBaseUrl);
  }

  private getLevelLabel(level: number): string {
    switch (level) {
      case 1:
        return 'Éco-Débutant';
      case 2:
        return 'Éco-Explorateur';
      case 3:
        return 'Voyageur Écolo';
      case 4:
        return 'Éco-Expert';
      case 5:
      default:
        return 'Champion du Climat';
    }
  }

  async getProfile(
    userId: string,
    email?: string,
  ): Promise<UserProfileResponse> {
    const { data: profile, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      this.logger.log(`Profil inexistant pour ${userId}, création auto...`);
      const defaultUsername = email ? email.split('@')[0] : 'Utilisateur';

      const { data: newProfile, error: insertError } = await this.supabase
        .from('profiles')
        .insert({
          id: userId,
          username: defaultUsername,
          avatar_url: '',
        })
        .select('*')
        .single();

      if (insertError || !newProfile) {
        this.logger.warn(
          `Erreur insertion profil pour ${userId}: ${insertError?.message}`,
        );
        return {
          id: userId,
          username: defaultUsername,
          avatar_url: '',
          level: 1,
          level_label: 'Voyageur Écolo',
          total_co2_saved_kg: 0,
          total_distance_km: 0,
          eco_points: 0,
          role: 'user',
          created_at: new Date().toISOString(),
        };
      }

      return {
        ...newProfile,
        avatar_url: this.formatAvatarUrl(newProfile.avatar_url),
        level_label: this.getLevelLabel(newProfile.level || 1),
      };
    }

    return {
      ...profile,
      avatar_url: this.formatAvatarUrl(profile.avatar_url),
      level_label: this.getLevelLabel(profile.level || 1),
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfileResponse> {
    const trimmedUsername = dto.username?.trim();
    if (!trimmedUsername || trimmedUsername.length < 2) {
      throw new BadRequestException(
        'Le nom complet doit comporter au moins 2 caractères',
      );
    }
    if (trimmedUsername.length > 50) {
      throw new BadRequestException(
        'Le nom complet ne peut pas dépasser 50 caractères',
      );
    }

    const { data, error } = await this.supabase
      .from('profiles')
      .update({
        username: trimmedUsername,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        'Impossible de mettre à jour le profil',
      );
    }

    return {
      ...data,
      avatar_url: this.formatAvatarUrl(data.avatar_url),
      level_label: this.getLevelLabel(data.level || 1),
    };
  }

  async uploadAvatar(
    userId: string,
    file: UploadedFilePayload,
  ): Promise<UserProfileResponse> {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/jpg',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Format de fichier non supporté. Formats acceptés : JPEG, PNG, WebP (max 5Mo)',
      );
    }

    const maxFileSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxFileSize) {
      throw new BadRequestException(
        'Taille de fichier trop volumineuse (maximum 5Mo autorisés)',
      );
    }

    // Assurer que le bucket avatars existe
    const { data: buckets } = await this.supabase.storage.listBuckets();
    const avatarsBucketExists = buckets?.some((b) => b.id === 'avatars');
    if (!avatarsBucketExists) {
      await this.supabase.storage.createBucket('avatars', {
        public: true,
        fileSizeLimit: maxFileSize,
        allowedMimeTypes,
      });
    }

    const fileExt = file.originalname?.split('.').pop() || 'jpg';
    const filePath = `${userId}/avatar-${Date.now()}.${fileExt}`;
    console.log(`Uploading avatar for user ${userId} to path: ${filePath}`);

    const { error: uploadError } = await this.supabase.storage
      .from('avatars')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      this.logger.error(`Erreur upload avatar: ${uploadError.message}`);
      throw new InternalServerErrorException(
        `Erreur lors du téléversement de la photo: ${uploadError.message}`,
      );
    }

    const rawUrl = this.configService.get<string>('SUPABASE_PUBLIC_URL');
    const cleanBaseUrl = (rawUrl || '').replace(/\/$/, '');
    const avatarUrl = `${cleanBaseUrl}/storage/v1/object/public/avatars/${filePath}`;

    const { data: updatedProfile, error: updateError } = await this.supabase
      .from('profiles')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (updateError || !updatedProfile) {
      throw new InternalServerErrorException(
        'Erreur lors de la mise à jour de la photo de profil',
      );
    }

    return {
      ...updatedProfile,
      avatar_url: this.formatAvatarUrl(updatedProfile.avatar_url),
      level_label: this.getLevelLabel(updatedProfile.level || 1),
    };
  }
}
