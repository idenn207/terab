import z from 'zod';

// ───── Device ──────────────────────────────
export const DeviceResponseSchema = z.object({
  id: z.string().uuid(),
  userAgent: z.string().optional(),
  createdAt: z.coerce.date(),
});

// ───── Register Device ──────────────────────────────
export const RegisterDeviceBodySchema = z.object({
  pushToken: z.string().min(1),
});

// ───── Types ──────────────────────────────
export type DeviceResponse = z.infer<typeof DeviceResponseSchema>;
export type RegisterDeviceBody = z.infer<typeof RegisterDeviceBodySchema>;
