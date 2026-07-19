import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SupabaseAuthGuard } from './supabase.guard';

@Module({
  imports: [SupabaseModule],
  providers: [SupabaseAuthGuard],
  exports: [SupabaseAuthGuard, SupabaseModule],
})
export class AuthModule {}
