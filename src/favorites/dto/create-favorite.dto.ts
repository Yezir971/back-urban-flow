import { z } from 'zod';

export const createFavoriteSchema = z.object({
  name: z.string().min(1, 'Le nom du favori est requis'),
  address: z.string().min(1, "L'adresse est requise"),
  start_address: z.string().optional().nullable(),
  start_coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional()
    .nullable(),
  icon: z.string().default('home'),
  coordinates: z.object({
    lat: z.number({ message: 'La latitude est requise' }),
    lng: z.number({ message: 'La longitude est requise' }),
  }),
});

export type CreateFavoriteDto = z.infer<typeof createFavoriteSchema>;
