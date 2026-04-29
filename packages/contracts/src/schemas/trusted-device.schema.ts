import z from 'zod';

// ───── TrustedDevice ──────────────────────────────
export const TrustedDeviceResponseSchema = z.object({
  id: z.string().uuid(),
  userAgent: z.string().optional(),
  createdAt: z.coerce.date(),
});

// ───── Types ──────────────────────────────
export type TrustedDeviceResponse = z.infer<typeof TrustedDeviceResponseSchema>;
