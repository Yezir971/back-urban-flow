import { z } from 'zod';

export enum WalkingSpeed {
  SLOW = 'slow',
  NORMAL = 'normal',
  FAST = 'fast',
}

export const updateUserPreferencesSchema = z.object({
  walking_speed: z.enum(['slow', 'normal', 'fast']),
  pref_metro: z.boolean(),
  pref_bus: z.boolean(),
  pref_bike: z.boolean(),
  pref_car: z.boolean(),
  pref_walk: z.boolean(),
});

export type UpdateUserPreferencesDto = z.infer<
  typeof updateUserPreferencesSchema
>;
