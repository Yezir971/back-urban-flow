import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase.module';
import { SUPABASE_CLIENT } from './supabase.constants';
import { SupabaseClient } from '@supabase/supabase-js';

describe('SupabaseModule', () => {
  let moduleRef: TestingModule;
  let supabaseClient: SupabaseClient;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [
            () => ({
              SUPABASE_URL: 'https://example.supabase.co',
              SUPABASE_KEY:
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4YW1wbGUiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYyMDAwMDAwMCwiZXhwIjoyNTIwMDAwMDAwfQ.dummy_signature',
              OTP_URL: 'https://example.com',
            }),
          ],
        }),
        SupabaseModule,
      ],
    }).compile();

    supabaseClient = moduleRef.get<SupabaseClient>(SUPABASE_CLIENT);
  });

  it('should be defined', () => {
    expect(moduleRef).toBeDefined();
  });

  it('should provide a SupabaseClient instance', () => {
    expect(supabaseClient).toBeDefined();
    expect(supabaseClient).toBeInstanceOf(SupabaseClient);
    expect(supabaseClient).toHaveProperty('auth');
    expect(supabaseClient).toHaveProperty('from');
  });
});
