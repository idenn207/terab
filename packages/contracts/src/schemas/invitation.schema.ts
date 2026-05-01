import z from 'zod';

// ───── Create Invitation ──────────────────────────────
export const CreateInvitationBodySchema = z.object({
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

export const InvitationResponseSchema = z.object({
  token: z.string(),
  url: z.string(),
  expiresAt: z.coerce.date(),
});

// ───── Validate Invitation ──────────────────────────────
export const ValidateInvitationResponseSchema = z.object({
  valid: z.boolean(),
});

// ───── Types ──────────────────────────────
export type CreateInvitationBody = z.infer<typeof CreateInvitationBodySchema>;
export type InvitationResponse = z.infer<typeof InvitationResponseSchema>;
export type ValidateInvitationResponse = z.infer<typeof ValidateInvitationResponseSchema>;
