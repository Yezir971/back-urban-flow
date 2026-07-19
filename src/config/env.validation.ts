import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  SUPABASE_URL: z
    .string()
    .url({ message: "SUPABASE_URL n'est pas une URL valide" }),
  SUPABASE_KEY: z.string().min(1, { message: "SUPABASE_KEY n'est pas valide" }),
  OTP_URL: z.string().url({ message: "OTP_URL n'est pas une URL valide" }),
});

// Env va nous permettre de typer les variables d'environnement dans le code, en s'assurant qu'elles respectent le schéma défini. Cela permet de bénéficier de l'autocomplétion et de la vérification de type lors du développement.
export type Env = z.infer<typeof envSchema>;

/**
 * Valide les variables d'environnement par rapport au schéma.
 * Lance une erreur si la validation échoue, empêchant l'application de démarrer.
 * @param config
 * @returns
 */
export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    console.error(
      '[error] - Environment validation failed! Missing or invalid environment variables:',
    );
    result.error.issues.forEach((issue) => {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    });
    throw new Error(
      '[error] - Environment validation failed. Please check your .env file.',
    );
  }

  return result.data;
}
