import { z } from 'zod';

export const createTripSchema = z.object({
  start_name: z.string().min(1, 'Nom de départ requis'),
  end_name: z.string().min(1, 'Nom de destination requis'),
  start_lat: z.number(),
  start_lon: z.number(),
  end_lat: z.number(),
  end_lon: z.number(),
  mode: z
    .enum([
      'TRANSIT',
      'SUBWAY',
      'TRAM',
      'BUS',
      'BICYCLE',
      'SCOOTER',
      'WALK',
      'CAR',
    ])
    .default('TRANSIT'),
  line_name: z.string().optional().nullable(),
  duration_minutes: z.number().int().nonnegative(),
  distance_meters: z.number().int().nonnegative(),
  co2_saved_kg: z.number().nonnegative().default(0),
  points_earned: z.number().int().nonnegative().default(10),
  trace: z.string().optional().nullable(),
});

export type CreateTripDto = z.infer<typeof createTripSchema>;
